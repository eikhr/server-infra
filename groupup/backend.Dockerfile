FROM alpine/git as downloader

RUN git clone https://github.com/eikhr/GroupUp.git

FROM maven:3.8-openjdk-18 as builder

WORKDIR /app
COPY --from=downloader /git/GroupUp/backend/ .

RUN mvn clean package -DskipTests

FROM openjdk:17-jdk-alpine as production

COPY --from=builder /app/target/*.jar app.jar
EXPOSE 80
ENTRYPOINT ["java","-jar","/app.jar","--server.port=80","--spring.datasource.url=jdbc:postgresql://groupup-db:5432/groupupdb"]
