# The correct AWS SAM build image based on the runtime of the function will be
# passed as build arg. The default allows to do `docker build .` when testing.
ARG IMAGE=public.ecr.aws/sam/build-nodejs12.x
FROM $IMAGE

# Install yarn
RUN npm install --global yarn@1.22.5

# Install esbuild
# (unsafe-perm because esbuild has a postinstall script)
ARG ESBUILD_VERSION=0
RUN npm install --global --unsafe-perm=true esbuild@$ESBUILD_VERSION

# Ensure all users can write to npm cache
RUN mkdir /tmp/npm-cache && \
    chmod -R 777 /tmp/npm-cache && \
    npm config --global set cache /tmp/npm-cache

# Ensure all users can write to yarn cache
RUN mkdir /tmp/yarn-cache && \
    chmod -R 777 /tmp/yarn-cache && \
    yarn config set cache-folder /tmp/yarn-cache

# Disable npm update notifications
RUN npm config --global set update-notifier false

# create non root user and change allow execute command for non root user
RUN /sbin/useradd -u 1000 user && chmod 711 /

CMD [ "esbuild" ]
