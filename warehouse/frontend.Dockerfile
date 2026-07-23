# Warehouse web frontend (Create React App). Source is cloned from GitHub;
# this build context (./warehouse) only supplies this Dockerfile + nginx.conf.
FROM alpine/git as downloader
RUN git clone https://github.com/ollfkaih/warehouse.git

FROM node:16-alpine as builder
WORKDIR /app
COPY --from=downloader /git/warehouse/webapp/package.json .
COPY --from=downloader /git/warehouse/webapp/yarn.lock .
RUN yarn install --frozen-lockfile
COPY --from=downloader /git/warehouse/webapp/ .
# Point the built app at the public API. The server is same-origin under
# /warehouse/* (Traefik routes it there), so no CORS. CI=false keeps CRA from
# treating lint warnings as build errors.
ENV REACT_APP_DOMAIN=https://warehouse.eikhr.no
ENV CI=false
RUN yarn build

FROM nginx:stable-alpine as production
COPY --from=builder /app/build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
