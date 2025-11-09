FROM node:latest
RUN apt-get install git
WORKDIR /app
COPY . .
RUN npm install
RUN mkdir build
RUN npm run build
RUN cp /app/build/devc /usr/local/bin/devc
RUN chmod +x /usr/local/bin/devc
WORKDIR /
RUN rm -rf /app
ENTRYPOINT ["/usr/local/bin/devc"]