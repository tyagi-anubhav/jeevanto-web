#!/bin/sh
# Proof 1: every fixed address answers 200 over HTTPS with a certificate curl verifies, on jeevanto.com; www and
# plain http redirect to it; an unknown address answers 404.
for p in / /what-it-does /circle /kin-mode /our-promise /help /privacy-policy /terms /refunds /check /recover /invited; do
  printf '%-16s https://jeevanto.com%-16s %s\n' "$p" "" "$(curl -s -o /dev/null -w '%{http_code} cert=%{ssl_verify_result}' https://jeevanto.com$p)"
  printf '%-16s www (https)                       %s\n' "$p" "$(curl -s -o /dev/null -w '%{http_code} → %{redirect_url} cert=%{ssl_verify_result}' https://www.jeevanto.com$p)"
  printf '%-16s http                              %s\n' "$p" "$(curl -s -o /dev/null -w '%{http_code} → %{redirect_url}' http://jeevanto.com$p)"
done
printf 'unknown address  %s\n' "$(curl -s -o /dev/null -w '%{http_code}' https://jeevanto.com/no-such-page)"
printf 'www, followed    %s\n' "$(curl -s -L -o /dev/null -w '%{http_code} at %{url_effective}' https://www.jeevanto.com/privacy-policy)"
# The certificate: who it's for, who issued it, when it ends, and the names it covers. Written for LibreSSL too (macOS's
# openssl has no -ext; this line used to print nothing there and end the script with 1, unnoticed until 12 Oct).
cert=$(echo | openssl s_client -connect jeevanto.com:443 -servername jeevanto.com 2>/dev/null | openssl x509 -noout -subject -issuer -enddate -text 2>/dev/null)
[ -n "$cert" ] || { echo 'FAIL the certificate could not be read'; exit 1; }
echo "$cert" | grep -E '^(subject|issuer|notAfter)='
echo "$cert" | grep -A1 'Subject Alternative Name' | tail -1 | sed 's/^ *//'
echo "$cert" | grep -q 'DNS:www.jeevanto.com' && echo "$cert" | grep -q 'DNS:jeevanto.com' || { echo 'FAIL the certificate does not cover jeevanto.com and www'; exit 1; }
