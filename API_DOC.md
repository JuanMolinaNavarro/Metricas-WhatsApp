# API Metrics WhatsApp CallBell (Power BI)

Esta API expone endpoints HTTP JSON pensados para consumo desde Power BI (Web.Contents).
Todas las fechas son locales de Argentina (America/Argentina/Tucuman) para el reporting.

## Base URL

- Local: `http://localhost:3000`
- Produccion: tu dominio/ngrok

## Autenticacion

- Webhooks: usar header `x-webhook-secret` si esta configurado `WEBHOOK_SECRET`.
- Endpoints de metricas: no requieren auth (agregar si lo necesitas).

## Formato de fechas

- Parametros `desde` y `hasta` en formato `YYYY-MM-DD`.
- `hasta` es inclusivo a nivel de dia (internamente se usa rango [desde, hasta+1)).

## Endpoints de salud

`GET /health`

Respuesta:
```
{ "status": "ok" }
```

## Endpoints de metricas

### Casos atendidos (same-day)

`GET /metrics/casos-atendidos?desde=YYYY-MM-DD&hasta=YYYY-MM-DD`

Respuesta:
```
[
  {
    "dia": "2025-12-30",
    "conversaciones_entrantes": 123,
    "conversaciones_atendidas_same_day": 95,
    "pct_atendidas": 77.24
  }
]
```

### Casos atendidos (resumen)

`GET /metrics/casos-atendidos/resumen?desde=YYYY-MM-DD&hasta=YYYY-MM-DD`

Respuesta:
```
{
  "conversaciones_entrantes": 123,
  "conversaciones_atendidas_same_day": 95,
  "pct_atendidas": 77.24
}
```

### FRT por dia + team + agente

`GET /metrics/tiempo-primera-respuesta?desde=YYYY-MM-DD&hasta=YYYY-MM-DD&team_uuid=&agent_email=`

Respuesta:
```
[
  {
    "dia": "2025-12-30",
    "team_uuid": "c93180c54de0449b805d318cc825d1c4",
    "team_name": "Salta Cable",
    "agent_email": "calltnieva@providers.com.ar",
    "casos_abiertos": 120,
    "casos_respondidos": 98,
    "avg_frt_seconds": 135.2,
    "median_frt_seconds": 70,
    "p90_frt_seconds": 260
  }
]
```

### FRT SLA por dia + team + agente

`GET /metrics/tiempo-primera-respuesta/sla?desde=YYYY-MM-DD&hasta=YYYY-MM-DD&max_seconds=300&team_uuid=&agent_email=`

Respuesta:
```
[
  {
    "dia": "2025-12-30",
    "team_uuid": "c93180c54de0449b805d318cc825d1c4",
    "team_name": "Salta Cable",
    "agent_email": "calltnieva@providers.com.ar",
    "casos_respondidos": 98,
    "casos_en_sla": 76,
    "pct_sla": 77.55
  }
]
```

### FRT resumen por agente

`GET /metrics/tiempo-primera-respuesta/resumen-agentes?desde=YYYY-MM-DD&hasta=YYYY-MM-DD`

Respuesta:
```
[
  {
    "agent_email": "calltnieva@providers.com.ar",
    "casos_abiertos": 120,
    "casos_respondidos": 98,
    "avg_frt_seconds": 135.2,
    "median_frt_seconds": 70,
    "p90_frt_seconds": 260
  }
]
```

### FRT resumen por equipo

`GET /metrics/tiempo-primera-respuesta/resumen-equipos?desde=YYYY-MM-DD&hasta=YYYY-MM-DD`

Respuesta:
```
[
  {
    "team_uuid": "c93180c54de0449b805d318cc825d1c4",
    "team_name": "Salta Cable",
    "casos_abiertos": 120,
    "casos_respondidos": 98,
    "avg_frt_seconds": 135.2,
    "median_frt_seconds": 70,
    "p90_frt_seconds": 260
  }
]
```

### FRT ranking por agente

`GET /metrics/tiempo-primera-respuesta/ranking-agentes?desde=YYYY-MM-DD&hasta=YYYY-MM-DD&order=asc&limit=10&team_uuid=`

Respuesta:
```
[
  {
    "agent_email": "calltnieva@providers.com.ar",
    "casos_respondidos": 98,
    "avg_frt_seconds": 135.2,
    "median_frt_seconds": 70,
    "p90_frt_seconds": 260
  }
]
```

### Duracion promedio por dia + team + agente

`GET /metrics/duracion-promedio?desde=YYYY-MM-DD&hasta=YYYY-MM-DD&team_uuid=&agent_email=`

Respuesta:
```
[
  {
    "dia": "2025-12-30",
    "team_uuid": "c93180c54de0449b805d318cc825d1c4",
    "team_name": "Salta Cable",
    "agent_email": "calltnieva@providers.com.ar",
    "conversaciones_cerradas": 40,
    "avg_duration_seconds": 820.5,
    "median_duration_seconds": 700,
    "p90_duration_seconds": 1400
  }
]
```

### Duracion resumen por agente

`GET /metrics/duracion-promedio/resumen-agentes?desde=YYYY-MM-DD&hasta=YYYY-MM-DD`

Respuesta:
```
[
  {
    "agent_email": "calltnieva@providers.com.ar",
    "conversaciones_cerradas": 40,
    "avg_duration_seconds": 820.5,
    "median_duration_seconds": 700,
    "p90_duration_seconds": 1400
  }
]
```

### Duracion resumen por equipo

`GET /metrics/duracion-promedio/resumen-equipos?desde=YYYY-MM-DD&hasta=YYYY-MM-DD`

Respuesta:
```
[
  {
    "team_uuid": "c93180c54de0449b805d318cc825d1c4",
    "team_name": "Salta Cable",
    "conversaciones_cerradas": 40,
    "avg_duration_seconds": 820.5,
    "median_duration_seconds": 700,
    "p90_duration_seconds": 1400
  }
]
```

## Power BI

Power BI puede consumir estos endpoints con:
- Obtener datos -> Web
- O usando Power Query (M) con `Web.Contents`.

Ejemplo en Power Query (M):
```
let
  Source = Json.Document(Web.Contents("http://localhost:3000/metrics/tiempo-primera-respuesta?desde=2025-12-01&hasta=2025-12-31"))
in
  Source
```

