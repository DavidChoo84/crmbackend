# Use Node 20 LTS
FROM node:20

# Set working directory
WORKDIR /usr/src/app

# Copy package files first for better caching
COPY package*.json ./

# Install dependencies
RUN npm install

# Rebuild bcrypt for Linux (important for Docker)
RUN npm rebuild bcrypt --build-from-source

# Copy the rest of the source code
COPY . .

# Build the NestJS project
RUN npm run build

# Expose the NestJS port
EXPOSE 3000

# Run the production build
CMD ["npm", "run", "start:prod"]
