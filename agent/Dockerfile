FROM python:3.12-slim
WORKDIR /app
RUN pip install google-adk==1.33.0 google-cloud-aiplatform httpx
COPY . /app/agent
# Switch ADK from Google AI Studio (API key) to Vertex AI (service account / ADC)
ENV GOOGLE_GENAI_USE_VERTEXAI=1
ENV GOOGLE_CLOUD_PROJECT=runbook-hackathon-2026
ENV GOOGLE_CLOUD_LOCATION=us-central1
EXPOSE 8080
CMD ["adk", "web", "--host", "0.0.0.0", "--port", "8080", "/app"]
