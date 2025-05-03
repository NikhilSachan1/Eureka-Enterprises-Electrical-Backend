FROM node:22-alpine

# Set the working directory inside the container
WORKDIR /app

# Copy package.json and package-lock.json files from the current directory to the working directory
COPY package*.json .

# Install app dependencies
RUN npm ci

# Copy all files and folders from the current directory to the working directory
COPY . .

# Build the application
RUN npm run build && npm run copy-hbs

# Expose the application port
EXPOSE 3333

# Set the command to run on container start
CMD ["sh", "-c", "npm run migration:run && npm run start:prod "]
