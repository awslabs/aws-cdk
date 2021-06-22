FROM public.ecr.aws/lambda/python:3.8

ADD . /opt/lambda
WORKDIR /opt/lambda

RUN pip3 install boto3==1.17.42
RUN python3 test_index.py

ENTRYPOINT [ "/bin/bash" ]