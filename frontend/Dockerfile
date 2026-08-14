FROM node:22-alpine AS build

WORKDIR /app

ARG VITE_API_BASE_URL=http://localhost:8000/v1
ARG VITE_MICROSOFT_CLIENT_ID=
ARG VITE_MICROSOFT_TENANT_ID=
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_MICROSOFT_CLIENT_ID=$VITE_MICROSOFT_CLIENT_ID
ENV VITE_MICROSOFT_TENANT_ID=$VITE_MICROSOFT_TENANT_ID

COPY package.json package-lock.json* ./
RUN npm install

COPY . .
RUN npm run build

FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
