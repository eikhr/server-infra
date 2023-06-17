source .env
cd /srv/infra/server-infra/
docker compose stop

docker run -i --rm --name certbot -p 443:443 -p 80:80 -v /srv/infra/server-infra/certbot/conf/:/etc/letsencrypt/ certbot/certbot renew --email eik@eikhr.no --logs-dir /etc/letsencrypt/logs

# Warehouse
docker run -i --rm --name certbot -p 443:443 -p 80:80 -v /etc/letsencrypt/:/etc/letsencrypt/ certbot/certbot certonly -a standalone -d www.eikhr.no -d eikhr.no --email eik@eikhr.no --logs-dir /etc/letsencrypt/logs
cd /etc/letsencrypt/live/eikhr.no/
openssl pkcs12 -export -in fullchain.pem -inkey privkey.pem -out keystore.p12 -name tomcat -CAfile chain.pem -caname root -passout pass:"$WAREHOUSE_SSL_PASSWORD"

# back to the normal stuff
cd /srv/infra/server-infra/
docker compose up -d
