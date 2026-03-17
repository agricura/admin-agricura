"""
sync_fintoc.py
──────────────
Obtiene movimientos bancarios desde Fintoc y los guarda en la tabla
`bank_transactions` de Supabase mediante upsert (no duplica).

Soporta múltiples cuentas: lee todos los links de la tabla `fintoc_links`
en Supabase. Si la tabla está vacía, usa FINTOC_LINK_TOKEN del env como fallback.

Ejecutado por GitHub Actions cada 6 horas.
También puede correrse localmente: python scripts/sync_fintoc.py

Variables de entorno requeridas:
  FINTOC_SECRET_KEY    — sk_live_... (Secret Key de Fintoc)
  SUPABASE_URL         — https://xxx.supabase.co
  SUPABASE_SERVICE_KEY — sb_secret_...
  FINTOC_LINK_TOKEN    — (opcional) fallback si fintoc_links está vacía
  SYNC_DAYS            — (opcional) días hacia atrás, default 90
"""

import os
import sys
import math
import requests
from datetime import datetime, timedelta, timezone
from supabase import create_client

# ── Configuración ─────────────────────────────────────────────────────────────
FINTOC_SECRET_KEY  = os.environ.get("FINTOC_SECRET_KEY", "")
FINTOC_LINK_TOKEN  = os.environ.get("FINTOC_LINK_TOKEN", "")  # fallback
SUPABASE_URL       = os.environ.get("SUPABASE_URL", "")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")
SYNC_DAYS          = int(os.environ.get("SYNC_DAYS", "90"))

FINTOC_BASE        = "https://api.fintoc.com/v1"
# Para la REST API de Fintoc: secret_key en Authorization, link_token en query params
FINTOC_HEADERS     = {"Authorization": FINTOC_SECRET_KEY}
BATCH_SIZE         = 500   # filas por upsert a Supabase
PER_PAGE           = 300   # máximo permitido por Fintoc


def validate_env():
    # FINTOC_LINK_TOKEN ya no es obligatorio (se lee de BD)
    missing = [k for k in ("FINTOC_SECRET_KEY", "SUPABASE_URL", "SUPABASE_SERVICE_KEY")
               if not os.environ.get(k)]
    if missing:
        print(f"[ERROR] Variables de entorno faltantes: {', '.join(missing)}")
        sys.exit(1)


def seed_legacy_link(supabase_client):
    """
    Si fintoc_links está vacía y FINTOC_LINK_TOKEN existe en env,
    inserta la cuenta legacy automáticamente (migración one-time).
    """
    if not FINTOC_LINK_TOKEN:
        return
    try:
        result = supabase_client.table("fintoc_links").select("id").limit(1).execute()
        if result.data:
            return  # ya hay registros
        link_id = FINTOC_LINK_TOKEN.split("_token_")[0] if "_token_" in FINTOC_LINK_TOKEN else FINTOC_LINK_TOKEN
        # Intentar obtener metadata desde Fintoc
        institution_name = None
        holder_name = None
        try:
            resp = requests.get(
                f"{FINTOC_BASE}/links/{link_id}",
                headers=FINTOC_HEADERS,
                timeout=15,
            )
            if resp.ok:
                data = resp.json()
                institution_name = (data.get("institution") or {}).get("name")
                holder_name = data.get("holder_name") or data.get("username")
        except Exception:
            pass
        supabase_client.table("fintoc_links").upsert({
            "link_token": FINTOC_LINK_TOKEN,
            "link_id": link_id,
            "institution_name": institution_name,
            "holder_name": holder_name,
        }, on_conflict="link_token").execute()
        print(f"[seed] Cuenta legacy migrada a fintoc_links ({link_id})")
    except Exception as e:
        print(f"[WARN] No se pudo migrar cuenta legacy: {e}")


def get_link_tokens(supabase_client) -> list:
    """
    Lee todos los link_tokens de la tabla fintoc_links.
    Auto-seed cuenta legacy si la tabla está vacía.
    """
    seed_legacy_link(supabase_client)

    tokens = []
    try:
        result = supabase_client.table("fintoc_links").select("link_token, institution_name").execute()
        if result.data:
            for row in result.data:
                tokens.append({
                    "link_token": row["link_token"],
                    "name": row.get("institution_name") or "Cuenta sin nombre",
                })
    except Exception as e:
        print(f"[WARN] No se pudo leer fintoc_links: {e}")

    if not tokens and FINTOC_LINK_TOKEN:
        print("[sync_fintoc] Usando FINTOC_LINK_TOKEN del env como fallback directo")
        tokens.append({"link_token": FINTOC_LINK_TOKEN, "name": "Cuenta (env)"})

    return tokens


def get_since_date(supabase_client) -> str:
    """
    Busca la fecha del movimiento más reciente en Supabase.
    Si hay datos, usa esa fecha menos 2 días (buffer de seguridad).
    Si no hay datos, usa SYNC_DAYS días atrás.
    """
    try:
        result = (
            supabase_client.table("bank_transactions")
            .select("date")
            .order("date", desc=True)
            .limit(1)
            .execute()
        )
        if result.data:
            latest = result.data[0]["date"]  # "YYYY-MM-DD"
            # Buffer de 2 días para asegurar que no se pierdan movimientos
            latest_dt = datetime.strptime(latest, "%Y-%m-%d") - timedelta(days=2)
            return latest_dt.strftime("%Y-%m-%d")
    except Exception as e:
        print(f"[WARN] No se pudo obtener fecha más reciente de Supabase: {e}")

    fallback = (datetime.now(timezone.utc) - timedelta(days=SYNC_DAYS)).strftime("%Y-%m-%d")
    return fallback


def get_accounts(link_token: str) -> list:
    url = f"{FINTOC_BASE}/accounts"
    params = {"link_token": link_token}
    resp = requests.get(url, headers=FINTOC_HEADERS, params=params, timeout=30)
    resp.raise_for_status()
    return resp.json()


def get_movements(account_id: str, since: str, link_token: str) -> list:
    """Obtiene todos los movimientos paginando con per_page=300."""
    all_movements = []
    page = 1
    url = f"{FINTOC_BASE}/accounts/{account_id}/movements"

    while True:
        params = {
            "link_token": link_token,
            "since": since,
            "page": page,
            "per_page": PER_PAGE
        }
        resp = requests.get(url, headers=FINTOC_HEADERS, params=params, timeout=30)
        resp.raise_for_status()
        data = resp.json()

        if not data:
            break

        all_movements.extend(data)

        # Si devolvió menos de per_page, ya terminamos
        if len(data) < PER_PAGE:
            break

        page += 1

    return all_movements


def build_row(mov: dict, account: dict) -> dict:
    """Convierte un movimiento de Fintoc en una fila para bank_transactions."""
    sender = mov.get("sender_account") or {}
    recipient = mov.get("recipient_account") or {}

    return {
        "id":               mov["id"],
        "account_id":       account["id"],
        "account_name":     account.get("name"),
        "account_number":   account.get("number"),
        "amount":           mov.get("amount"),
        "currency":         account.get("currency", "CLP"),
        "date":             mov.get("post_date") or mov.get("transaction_date"),
        "description":      mov.get("description"),
        "reference_id":     mov.get("id"),
        "transaction_type": mov.get("type"),
        "balance":          mov.get("balance"),
        "sender_name":      sender.get("holder_name"),
        "recipient_name":   recipient.get("holder_name"),
        "synced_at":        datetime.now(timezone.utc).isoformat(),
    }


def upsert_rows(supabase_client, rows: list) -> int:
    """Hace upsert en lotes de BATCH_SIZE. Devuelve el total de filas procesadas."""
    total = 0
    num_batches = math.ceil(len(rows) / BATCH_SIZE)
    for i in range(num_batches):
        batch = rows[i * BATCH_SIZE : (i + 1) * BATCH_SIZE]
        supabase_client.table("bank_transactions").upsert(
            batch, on_conflict="id"
        ).execute()
        total += len(batch)
        print(f"  Lote {i + 1}/{num_batches}: {len(batch)} filas guardadas.")
    return total


def sync_link(supabase_client, link_token: str, link_name: str, since: str) -> int:
    """Sincroniza un link individual. Retorna cantidad de filas guardadas."""
    link_id = link_token.split("_token_")[0] if "_token_" in link_token else link_token
    print(f"\n[sync_fintoc] ── {link_name} (ID: {link_id}) ──")

    accounts = get_accounts(link_token)
    print(f"[sync_fintoc] {len(accounts)} cuenta(s) encontrada(s).")

    all_rows = []
    for account in accounts:
        name = account.get("name", account["id"])
        print(f"  → Cuenta: {name} ({account.get('number', '—')})")
        movements = get_movements(account["id"], since, link_token)
        print(f"    {len(movements)} movimiento(s) obtenido(s).")
        for mov in movements:
            all_rows.append(build_row(mov, account))

    if not all_rows:
        print(f"[sync_fintoc] Sin movimientos nuevos para {link_name}.")
        return 0

    print(f"[sync_fintoc] Guardando {len(all_rows)} filas en Supabase...")
    return upsert_rows(supabase_client, all_rows)


def main():
    validate_env()
    print(f"[sync_fintoc] Iniciando sync — {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}")

    supabase_client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    # Obtener todos los links vinculados
    links = get_link_tokens(supabase_client)
    if not links:
        print("[sync_fintoc] No hay cuentas vinculadas ni FINTOC_LINK_TOKEN configurado. Nada que sincronizar.")
        sys.exit(0)

    print(f"[sync_fintoc] {len(links)} cuenta(s) vinculada(s) a sincronizar.")

    since = get_since_date(supabase_client)
    print(f"[sync_fintoc] Obteniendo movimientos desde {since} ({SYNC_DAYS}d máx)...")

    total_saved = 0
    for link in links:
        try:
            saved = sync_link(supabase_client, link["link_token"], link["name"], since)
            total_saved += saved
        except Exception as e:
            print(f"[ERROR] Fallo al sincronizar {link['name']}: {e}")
            continue

    print(f"\n[sync_fintoc] ✓ Sync completo: {total_saved} transacciones de {len(links)} cuenta(s).")


if __name__ == "__main__":
    main()
