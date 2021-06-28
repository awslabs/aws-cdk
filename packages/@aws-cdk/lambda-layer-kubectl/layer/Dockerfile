# base lambda image
FROM public.ecr.aws/lambda/provided:latest

#
# versions
#

ARG KUBECTL_VERSION=1.20.0
ARG HELM_VERSION=3.5.4

USER root
RUN mkdir -p /opt
WORKDIR /tmp

#
# tools
#

RUN yum update -y \
    && yum install -y zip unzip wget tar gzip

#
# kubectl
#

RUN mkdir -p /opt/kubectl
RUN cd /opt/kubectl && curl -LO "https://storage.googleapis.com/kubernetes-release/release/v${KUBECTL_VERSION}/bin/linux/amd64/kubectl"
RUN chmod +x /opt/kubectl/kubectl

#
# helm
#

RUN mkdir -p /tmp/helm && wget -qO- https://get.helm.sh/helm-v${HELM_VERSION}-linux-amd64.tar.gz | tar -xvz -C /tmp/helm
RUN mkdir -p /opt/helm && cp /tmp/helm/linux-amd64/helm /opt/helm/helm

#
# create the bundle
#

RUN cd /opt \
    && zip --symlinks -r ../layer.zip * \
    && echo "/layer.zip is ready" \
    && ls -alh /layer.zip;

WORKDIR /
ENTRYPOINT [ "/bin/bash" ]