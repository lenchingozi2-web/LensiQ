FROM python:3.11-slim-bookworm

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

RUN set -eux; \
    apt-get clean; \
    rm -rf /var/lib/apt/lists/*; \
    apt-get -o Acquire::Retries=5 update; \
    apt-get -o Acquire::Retries=5 install -y --no-install-recommends \
      ca-certificates \
      ffmpeg \
      libgl1 \
      libsndfile1; \
    rm -rf /var/lib/apt/lists/*; \
    apt-get clean

WORKDIR /app
COPY requirements.txt ./
RUN pip install --upgrade pip && pip install -r requirements.txt
COPY agent.py ./

USER nobody
CMD ["python", "agent.py"]
