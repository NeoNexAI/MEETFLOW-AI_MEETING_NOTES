# ADR-002 — Modelo freemium + activación por licencia offline

- **Estado**: Aceptado
- **Fecha**: 2026-05-29
- **Decisores**: Jonatan García (CEO) + CTO agent

## Contexto

El plan maestro y el ADR-001 definían MeetFlow como app de escritorio
**open source gratuita (MIT)**, sin servidor ni cuentas. Posteriormente, la
dirección decidió pasar a un modelo **freemium comercial (desktop)**: mantener
un núcleo gratuito, pero introducir un **tier Pro de pago**.

El reto: monetizar **sin traicionar el posicionamiento privacy-first / local-first**.
Un esquema SaaS clásico (cuentas + login + servidor que valida en cada arranque)
contradice la promesa central de "tus datos nunca salen del dispositivo".

## Decisión

1. **Núcleo OSS gratuito (MIT)** — se mantiene. Incluye: grabación ilimitada,
   transcripción local (modelos tiny/small), resúmenes con Ollama local,
   notas, export Markdown, EN/ES.

2. **Tier Pro de pago** — desbloquea funcionalidad de mayor valor sin tocar la
   privacidad del núcleo. Candidatos a Pro:
   - Modelos Whisper grandes (medium / large-v3-turbo).
   - Proveedores LLM cloud (Claude, OpenAI, Groq, OpenRouter, Mistral).
   - Exports avanzados (PDF, JSON estructurado).
   - Integraciones y AI Agent Executor (cuando lleguen en v0.2+).

3. **Activación por clave de licencia firmada, verificada OFFLINE** (Ed25519):
   - El operador firma claves con una clave privada que **nunca** sale de su
     infraestructura.
   - La app embebe únicamente la **clave pública** y verifica la firma localmente.
   - **Sin phone-home**: no se contacta a ningún servidor para validar; preserva
     el local-first y funciona sin conexión.
   - La licencia codifica: email/comprador, tier, fecha de emisión y (opcional)
     expiración.

4. **Checkout vía Stripe Payment Link / Checkout hospedado**:
   - El cliente compra en una URL de Stripe (no se procesan tarjetas en la app).
   - Un webhook de Stripe (backend mínimo del operador) emite y envía la clave
     de licencia firmada por email.
   - En la app: pantalla "Upgrade to Pro" con el enlace + campo para pegar la clave.

## Consecuencias

**Positivas:**
- Monetización sin servidor de auth ni base de datos de usuarios.
- Mantiene intacta la promesa de privacidad (verificación offline).
- Mínima superficie de backend (solo emisión de claves tras pago).
- El núcleo OSS sigue siendo auditable y libre.

**Negativas:**
- Las claves offline son, por naturaleza, compartibles (no hay revocación en
  tiempo real). Mitigación: claves ligadas al email del comprador + posible
  validación online opcional en el futuro.
- Requiere custodia segura de la clave privada de firma del operador.
- El binario es open source: el gating es disuasorio, no inviolable. Se asume
  (modelo "honor + conveniencia", como Sublime Text / muchos indie apps).

## Alcance de implementación en esta fase

- ✅ Cliente: módulo de entitlements + verificación de firma + UI de activación.
- ✅ Herramienta de emisión de claves para el operador (firma local + test).
- ⬜ Webhook de Stripe + envío por email (runbook de operación; fuera del binario).

## Alternativas descartadas

- **SaaS completo con cuentas/login**: rompe local-first; mayor coste/superficie.
- **Validación online en cada arranque**: contradice "funciona offline" y privacidad.
- **Sin DRM (donaciones)**: no encaja con la decisión de negocio de tier de pago.

## Referencias
- ADR-001 — stack base y recorte de scope.
- docs/PRODUCTION_READINESS.md — roadmap a release.
