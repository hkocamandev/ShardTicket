FROM grafana/k6:0.53.0 AS k6src

FROM node:18
WORKDIR /app
COPY --from=k6src /usr/bin/k6 /usr/local/bin/k6
COPY --chown=node:node package*.json ./
RUN npm install
COPY --chown=node:node . .
USER node
EXPOSE 3000
CMD ["npm", "run", "dev"]
