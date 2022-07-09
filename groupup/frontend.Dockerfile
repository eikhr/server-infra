FROM alpine/git as downloader

RUN git clone https://github.com/eikhr/GroupUp.git

FROM node:16-alpine as builder

WORKDIR /app
COPY --from=downloader /git/GroupUp/groupup/package.json .
COPY --from=downloader /git/GroupUp/groupup/yarn.lock .
RUN yarn install --frozen-lockfile
ENV NODE_ENV production

COPY --from=downloader /git/GroupUp/groupup/ .
RUN yarn build

FROM nginx:stable-alpine as production
ENV NODE_ENV production
COPY --from=builder /app/build /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
