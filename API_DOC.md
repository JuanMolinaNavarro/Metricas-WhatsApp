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

Notas:
- `conversaciones_entrantes` representa casos recibidos (base `conversation_cases`).
- `conversaciones_atendidas_same_day` considera casos respondidos el mismo dia local de apertura.
- Para eventos `message_created`, el tiempo canonico es la recepcion del webhook en servidor.

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

### Ranking compuesto de agentes

`GET /metrics/tiempo-primera-respuesta/ranking-agentes-compuesto?desde=YYYY-MM-DD&hasta=YYYY-MM-DD&max_seconds=300&limit=100&team_uuid=&as_of=`

Respuesta:
```
[
  {
    "agent_email": "calltnieva@providers.com.ar",
    "casos_respondidos": 98,
    "casos_en_sla": 76,
    "pct_sla": 77.55,
    "casos_abiertos_resueltos": 120,
    "casos_resueltos": 95,
    "pct_resueltos": 79.17,
    "casos_abiertos_abandonados": 25,
    "casos_abandonados_24h": 2,
    "pct_abandonados_24h": 8.0,
    "score_abandonos_invertido": 92.0,
    "puntos_cumplimiento_atencion": 27.14,
    "puntos_resolucion_efectiva": 19.79,
    "puntos_abandonos": 18.4,
    "score_final": 65.33
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

### Casos cerrados el mismo dia de apertura

`GET /metrics/casos-cerrados-mismo-dia?desde=YYYY-MM-DD&hasta=YYYY-MM-DD&team_uuid=&agent_email=`

Cuenta cuantos casos fueron **abiertos y cerrados en el mismo dia local** (`America/Argentina/Tucuman`).

Respuesta:
```
[
  {
    "dia": "2025-12-30",
    "team_uuid": "c93180c54de0449b805d318cc825d1c4",
    "team_name": "Salta Cable",
    "agent_email": "calltnieva@providers.com.ar",
    "casos_abiertos": 50,
    "casos_cerrados_mismo_dia": 38,
    "pct_cerrados_mismo_dia": 76.00
  }
]
```

- `casos_abiertos`: total de casos abiertos ese dia (por `local_date`).
- `casos_cerrados_mismo_dia`: de esos, cuantos tienen `is_closed = true` y `closed_received_at_utc` en el mismo dia local.
- `pct_cerrados_mismo_dia`: porcentaje sobre `casos_abiertos`.
- Filtros opcionales: `team_uuid`, `agent_email`.

---

### Horarios de contacto (ultimos 7 dias)

`GET /metrics/horarios-contacto/ultimos-7-dias`

Respuesta:
```
[
  {
    "hora_del_dia": 10,
    "hora": "10:00",
    "conversaciones_abiertas": 245,
    "pct_total": 21.83,
    "ranking_popularidad": 1
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



## Endpoints de rangos recientes

- `GET /metrics/casos-atendidos/ultimas-24h`
- `GET /metrics/casos-atendidos/ultimas-48h`
- `GET /metrics/casos-atendidos/ultimos-7-dias`
- `GET /metrics/casos-abiertos/ultimas-24h?team_uuid=&agent_email=`
- `GET /metrics/casos-abiertos/ultimas-48h?team_uuid=&agent_email=`
- `GET /metrics/casos-abiertos/ultimos-7-dias?team_uuid=&agent_email=`
- `GET /metrics/tiempo-primera-respuesta/ultimas-24h?team_uuid=&agent_email=`
- `GET /metrics/tiempo-primera-respuesta/ultimas-48h?team_uuid=&agent_email=`
- `GET /metrics/tiempo-primera-respuesta/ultimos-7-dias?team_uuid=&agent_email=`
- `GET /metrics/casos-resueltos/ultimas-24h?team_uuid=&agent_email=`
- `GET /metrics/casos-resueltos/ultimas-48h?team_uuid=&agent_email=`
- `GET /metrics/casos-resueltos/ultimos-7-dias?team_uuid=&agent_email=`
- `GET /metrics/casos-abandonados-24h/ultimas-24h?team_uuid=&agent_email=&as_of=`
- `GET /metrics/casos-abandonados-24h/ultimas-48h?team_uuid=&agent_email=&as_of=`
- `GET /metrics/casos-abandonados-24h/ultimos-7-dias?team_uuid=&agent_email=&as_of=`
- `GET /metrics/horarios-contacto/ultimos-7-dias`

## Usuarios y login

Nota: Estos endpoints no aplican hashing de passwords (texto plano).

### Login

`POST /auth/login`

Body:
```
{
  "username": "jmolina",
  "password": "290601"
}
```

Respuesta:
```
{
  "id": 1,
  "username": "jmolina",
  "nombre": "Jose",
  "apellido": "Molina",
  "rol": "sa",
  "isActive": true
}
```

### Crear usuario

`POST /users`

Body:
```
{
  "username": "user1",
  "password": "1234",
  "nombre": "Ana",
  "apellido": "Perez",
  "rol": "admin"
}
```

Respuesta:
```
{
  "id": 2,
  "username": "user1",
  "nombre": "Ana",
  "apellido": "Perez",
  "rol": "admin",
  "isActive": true
}
```

### Modificar usuario

`PUT /users/:id`

Body (campos opcionales):
```
{
  "password": "nuevo",
  "nombre": "Ana Maria",
  "rol": "supervisor"
}
```

### Desactivar usuario

`PATCH /users/:id/deactivate`
