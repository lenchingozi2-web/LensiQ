# syntax=docker/dockerfile:1
FROM python:3.11-slim
ENV PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1
WORKDIR /app
RUN useradd --create-home --uid 10001 --shell /usr/sbin/nologin tutor
COPY requirements.txt /app/requirements.txt
RUN python -m pip install --no-cache-dir --disable-pip-version-check -r requirements.txt
COPY agent.py /app/agent.py
USER tutor
CMD ["python", "agent.py", "start"]
