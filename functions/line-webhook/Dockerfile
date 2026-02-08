# Use Node.js 24 slim base image
FROM node:24-slim

# Install ffmpeg
RUN apt-get update && \
    apt-get install -y ffmpeg && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Verify ffmpeg installation
RUN ffmpeg -version
