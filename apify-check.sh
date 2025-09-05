#!/usr/bin/env bash
set -euo pipefail

# Script per verificare dataset/run/key-value su Apify
# USO:
#   1) salva come apify-check.sh
#   2) chmod +x apify-check.sh
#   3) ./apify-check.sh    (ti chiederà token, dataset id e run id)

read -p "APIFY token (will NOT be shown) : " -r APIFY_TOKEN
echo "OK token received."

read -p "DATASET_ID (se lo sai, altrimenti lascia vuoto e premi ENTER): " -r DATASET_ID
read -p "RUN_ID (se lo sai, altrimenti lascia vuoto e premi ENTER): " -r RUN_ID

echo
echo "=== 1) Metadata dataset (se DATASET_ID fornito) ==="
if [ -n "$DATASET_ID" ]; then
  curl -s "https://api.apify.com/v2/datasets/${DATASET_ID}?token=${APIFY_TOKEN}" | jq .
else
  echo "Saltato (nessun DATASET_ID)."
fi

echo
echo "=== 2) Primo blocco items (se DATASET_ID fornito) ==="
if [ -n "$DATASET_ID" ]; then
  curl -s "https://api.apify.com/v2/datasets/${DATASET_ID}/items?token=${APIFY_TOKEN}&clean=true&limit=20" | jq .
else
  echo "Saltato (nessun DATASET_ID)."
fi

if [ -n "$RUN_ID" ]; then
  echo
  echo "=== 3) Info run (RUN_ID fornito) ==="
  curl -s "https://api.apify.com/v2/runs/${RUN_ID}?token=${APIFY_TOKEN}" | jq .
  echo
  echo "--- cerco defaultKeyValueStoreId / defaultDatasetId ---"
  curl -s "https://api.apify.com/v2/runs/${RUN_ID}?token=${APIFY_TOKEN}" | jq '.defaultKeyValueStoreId, .defaultDatasetId, .data?.defaultKeyValueStoreId, .data?.defaultDatasetId'
fi

echo
echo "=== 4) Se trovi defaultKeyValueStoreId te lo scarico (chiedi valore) ==="
read -p "Se vuoi controllare KVS, inserisci KEY_VALUE_STORE_ID (altrimenti ENTER): " -r KVID
if [ -n "$KVID" ]; then
  echo "Keys in KVS $KVID :"
  curl -s "https://api.apify.com/v2/key-value-stores/${KVID}/keys?token=${APIFY_TOKEN}" | jq .
  echo "Se vuoi scaricare la key 'OUTPUT' ora la mostro (se esiste):"
  curl -s "https://api.apify.com/v2/key-value-stores/${KVID}/records/OUTPUT?token=${APIFY_TOKEN}" | jq .
fi

echo
echo "=== 5) Test: provo a POSTare 1 item di prova (solo se DATASET_ID fornito) ==="
if [ -n "$DATASET_ID" ]; then
  curl -s -X POST "https://api.apify.com/v2/datasets/${DATASET_ID}/items?token=${APIFY_TOKEN}" \
    -H "Content-Type: application/json" \
    -d '[{"_test":"ok","title":"TEST ITEM","ts":"'"$(date -Iseconds)"'"}]' | jq .
  echo "Ora rileggiamo metadata dataset:"
  curl -s "https://api.apify.com/v2/datasets/${DATASET_ID}?token=${APIFY_TOKEN}" | jq .
  echo "E i primi items:"
  curl -s "https://api.apify.com/v2/datasets/${DATASET_ID}/items?token=${APIFY_TOKEN}&clean=true&limit=10" | jq .
else
  echo "Saltato POST test (nessun DATASET_ID)."
fi

echo
echo "=== FINE ==="


