# Use Node.js image
FROM node:18 as build-stage

# Set working directory
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./


ARG REACT_APP_API_URL
ENV REACT_APP_API_URL=$REACT_APP_API_URL
# Install dependencies
RUN npm install

# Copy the rest of the application code
COPY . .
RUN npm run build


FROM nginx:1.21

COPY --from=build-stage /app/build /usr/share/nginx/html

CMD nginx -g 'daemon off;'
