FROM node:latest
RUN apt-get update && apt-get install git jq
WORKDIR /app
COPY . .
RUN npm install
RUN mkdir build
RUN npm run build
RUN cp /app/build/devc /usr/local/bin/devc
RUN chmod +x /usr/local/bin/devc
RUN rm -rf /app/build

ENV DEVC_CONTROLLER_DOMAIN=""
ENV DEVC_CONTROLLER_NAMESPACE=""
ENV DEVC_CONTROLLER_ISSUER_NAME=""
ENV DEVC_CONTROLLER_ISSUER_KIND=""
ENV DEVC_CONTROLLER_POOL_LABEL=""

RUN chmod +x /app/devc-image/bootstrap-env.sh
ENTRYPOINT ["/app/devc-image/bootstrap-env.sh"]