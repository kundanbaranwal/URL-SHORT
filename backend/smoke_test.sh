#!/bin/bash
# Smoke test for every route. Run this AFTER `npm run dev` is already running
# locally with MongoDB and Redis reachable, from a second terminal:
#
#   chmod +x smoke_test.sh && ./smoke_test.sh
#
# It walks through the full flow: register -> login -> shorten (anonymous)
# -> shorten (authenticated) -> redirect -> analytics (owner) ->
# analytics (non-owner, should be rejected) -> rate limit check.

BASE_URL="http://localhost:5000"
EMAIL="test_$(date +%s)@example.com"
PASSWORD="password123"

echo "== 1. Register =="
REGISTER_RES=$(curl -s -X POST "$BASE_URL/api/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")
echo "$REGISTER_RES"
TOKEN=$(echo "$REGISTER_RES" | node -e "process.stdin.on('data', d => console.log(JSON.parse(d).token))")

echo -e "\n== 2. Login (same credentials) =="
curl -s -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}"

echo -e "\n\n== 3. Shorten a URL (authenticated) =="
SHORTEN_RES=$(curl -s -X POST "$BASE_URL/api/shorten" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"longUrl":"https://www.anthropic.com/some/very/long/path"}')
echo "$SHORTEN_RES"
CODE=$(echo "$SHORTEN_RES" | node -e "process.stdin.on('data', d => console.log(JSON.parse(d).shortCode))")

echo -e "\n== 4. Shorten a URL (anonymous, no token) =="
curl -s -X POST "$BASE_URL/api/shorten" \
  -H "Content-Type: application/json" \
  -d '{"longUrl":"https://example.com/another/link"}'

echo -e "\n\n== 5. Redirect (should return a 302 Location header) =="
curl -s -D - -o /dev/null "$BASE_URL/$CODE" | grep -i "location\|HTTP"

echo -e "\n== 6. Analytics as the owner (should succeed) =="
curl -s "$BASE_URL/api/analytics/$CODE" \
  -H "Authorization: Bearer $TOKEN"

echo -e "\n\n== 7. Analytics with no token (should 401) =="
curl -s "$BASE_URL/api/analytics/$CODE"

echo -e "\n\n== 8. Invalid short code (should 404) =="
curl -s "$BASE_URL/doesNotExist123"

echo -e "\n\n== 9. Rate limit check: fire 12 rapid anonymous shorten requests (limit is 10/min) =="
for i in $(seq 1 12); do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/api/shorten" \
    -H "Content-Type: application/json" \
    -d '{"longUrl":"https://example.com/loop-test"}')
  echo "Request $i -> HTTP $STATUS"
done

echo -e "\nDone. Expect request 11 and 12 above to return 429."
