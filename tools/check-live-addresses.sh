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
echo | openssl s_client -connect jeevanto.com:443 -servername jeevanto.com 2>/dev/null | openssl x509 -noout -subject -issuer -enddate -ext subjectAltName 2>/dev/null
