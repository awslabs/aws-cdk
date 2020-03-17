FROM python:3

# The following label allows this image to deployed within an inference pipeline
LABEL com.amazonaws.sagemaker.capabilities.accept-bind-to-port=true

# Avoid buffering output to expedite log delivery
ENV PYTHONUNBUFFERED=TRUE

# Default to port 8080 unless SageMaker has passed in its own port (for use within an inference pipline)
ENV SAGEMAKER_BIND_TO_PORT=${SAGEMAKER_BIND_TO_PORT:-8080}
EXPOSE $SAGEMAKER_BIND_TO_PORT

# Set up the server application
ENV PROGRAM_DIRECTORY=/opt/program
RUN mkdir -p $PROGRAM_DIRECTORY
COPY index.py $PROGRAM_DIRECTORY
ENV PATH="${PROGRAM_DIRECTORY}:${PATH}"
WORKDIR $PROGRAM_DIRECTORY
ENTRYPOINT ["python3", "index.py"]
