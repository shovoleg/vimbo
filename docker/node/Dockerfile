FROM node:20-alpine

RUN apk add --no-cache ffmpeg font-dejavu fontconfig wget \
    && fc-cache -f

WORKDIR /srv/app

EXPOSE 3000
