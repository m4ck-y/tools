# DOCUMENTACIÓN DE ENDPOINTS: /encrypt y /decrypt

Este documento describe el funcionamiento de los dos endpoints implementados en `main.py` utilizando FastAPI, incluyendo sus parámetros, lógica interna, salidas y diagramas de flujo.

Proyecto: `tools`

Dependencias relevantes:
- FastAPI (exposición de endpoints)
- PyCryptodome (AES-CBC, padding)

Notas importantes sobre el diseño actual:
- Ambos endpoints están definidos con parámetros de función simples (no modelos Pydantic). En FastAPI, esto hace que los parámetros se interpreten como Query Parameters por defecto en las solicitudes POST, salvo que se indique lo contrario.
- La clave (`key`) se envía y se recibe en Base64, y debe decodificarse a bytes para el uso con AES.
- El tamaño de la clave AES debe ser 16, 24 o 32 bytes (AES-128/192/256) tras decodificar Base64.

---

## 1) POST /encrypt

Firma en el código:

```python
@app.post("/encrypt")
def encrypt_payload(key, data):
```

- Entrada:
  - `key` (Query param, str): Clave AES codificada en Base64. Debe decodificar a 16/24/32 bytes.
  - `data` (Query param, str | dict): Datos a cifrar. Si es dict, se convierte a JSON (str) y luego a bytes UTF-8.

- Proceso interno:
  1. Decodifica `key` desde Base64 a bytes.
  2. Si `data` es `dict`, se serializa con `json.dumps`.
  3. Si `data` es `str`, se convierte a bytes UTF-8.
  4. Genera un IV aleatorio de 16 bytes (`AES.block_size`).
  5. Crea un cifrador AES en modo CBC con la `key` y el `iv`.
  6. Aplica padding PKCS#7 y cifra los datos.
  7. Codifica en Base64 el `iv` y el payload cifrado.
  8. Devuelve un string con el formato: `"<iv_base64>::<payload_base64>"`.

- Salida:
  - `text/plain` (str): `"{iv_base64}::{payload_base64}"`.

- Ejemplo de uso (curl):

```bash
# Ejemplo con clave AES-256 (32 bytes) en Base64 y data JSON
KEY_B64="c29tZV9yYW5kb21fMzJieXRlc19hZXNfa2V5X2Jhc2U2NA=="  # ejemplo, NO realista
curl -X POST "http://localhost:8000/encrypt?key=${KEY_B64}" \
     --data-urlencode "data={\"user\":\"john\",\"role\":\"admin\"}"
```

- Manejo de errores:
  - No hay `try/except` explícito en este endpoint. Errores comunes: clave Base64 inválida, longitud de clave inválida.

### Diagrama de flujo (/encrypt)

```mermaid
flowchart TD
  A[Inicio] --> B[Recibir key (Base64) y data]
  B --> C[Decodificar key desde Base64 a bytes]
  C --> D{data es dict?}
  D -- Sí --> E[json.dumps(data)]
  D -- No --> F[data es str]
  E --> G[UTF-8 encode]
  F --> G[UTF-8 encode]
  G --> H[Generar IV aleatorio (16 bytes)]
  H --> I[Crear AES-CBC con key e IV]
  I --> J[pad(data), encrypt]
  J --> K[Base64(iv), Base64(ciphertext)]
  K --> L[Construir "iv_b64::payload_b64"]
  L --> M[Retornar string]
```

---

## 2) POST /decrypt

Firma en el código:

```python
@app.post("/decrypt")
def get_decrypted_data(data_encrypted: str, key: str):
```

- Entrada:
  - `data_encrypted` (Query param, str): Cadena con formato `"<iv_base64>::<payload_base64>"` devuelta por `/encrypt`.
  - `key` (Query param, str): Clave AES codificada en Base64.

- Proceso interno:
  1. Decodifica `key` Base64 a bytes (`base_key`).
  2. Llama a `decrypt_payload(base_key, data_encrypted)`.

- Implementación de `decrypt_payload(key: bytes, encrypted_payload: str)`:
  1. Separa `encrypted_payload` por `"::"` en `iv_base64` y `payload_base64`.
  2. Decodifica ambos desde Base64 a bytes.
  3. Crea un cifrador AES-CBC con `key` y `iv`.
  4. Descifra `payload` y elimina padding con `unpad`.
  5. Decodifica a `utf-8` y retorna el string JSON.
  6. Si ocurre un error, imprime el error y retorna `False`.

- Salida:
  - Si la desencriptación es exitosa: `application/json` (objeto). El endpoint hace `json.loads(payload)` y devuelve ese objeto JSON.
  - Si falla la desencriptación o el parseo: `false` (booleano), debido al `return False` en el flujo actual.

- Ejemplo de uso (curl):

```bash
# Asumiendo que ENC contiene la salida devuelta por /encrypt
curl -X POST "http://localhost:8000/decrypt?key=${KEY_B64}&data_encrypted=${ENC}"
```

- Manejo de errores:
  - Si `encrypted_payload` no contiene `::` o los Base64 son inválidos, retorna `False`.
  - Si el tamaño de `key` decodificada no es válido (16/24/32 bytes), lanzará excepción y terminará retornando `False`.

### Diagrama de flujo (/decrypt)

```mermaid
flowchart TD
  A[Inicio] --> B[Recibir key (Base64) y data_encrypted]
  B --> C[Decodificar key desde Base64 a bytes]
  C --> D[Llamar decrypt_payload]
  D --> E[Split data_encrypted por "::"]
  E --> F[Base64 decode iv y payload]
  F --> G[Crear AES-CBC con key e IV]
  G --> H[Decrypt y unpad]
  H --> I[UTF-8 decode (string JSON)]
  I --> J{¿Éxito?}
  J -- Sí --> K[json.loads] --> L[Retornar objeto JSON]
  J -- No --> M[Retornar False]
```

---

## Consideraciones de seguridad y buenas prácticas

- Validación de entradas:
  - Validar que `key` decodificada tenga longitud 16, 24 o 32 bytes.
  - Validar que `data_encrypted` respete el formato `iv::payload`.
- Manejo de errores:
  - Uniformar respuestas de error (p. ej., `HTTPException` con códigos 400/422) en lugar de `False`.
- Tipado y esquemas:
  - Usar modelos Pydantic para definir el cuerpo de las solicitudes (`Body`) y mejorar la documentación automática (OpenAPI/Swagger).
  - Declarar tipos de `key` y `data` para claridad.
- Compatibilidad:
  - Asegurar que el padding usado sea PKCS#7 de punta a punta.
  - Fijar el encoding UTF-8 para la carga útil serializada.
- Registro:
  - Evitar imprimir claves o datos sensibles en logs en producción.

## Ejemplos de modelos propuestos (opcional)

```python
from pydantic import BaseModel
from fastapi import Body

class EncryptRequest(BaseModel):
    key_b64: str
    data: dict | str

class DecryptRequest(BaseModel):
    key_b64: str
    data_encrypted: str  # "iv_b64::payload_b64"

@app.post("/encrypt")
def encrypt_endpoint(req: EncryptRequest):
    return encrypt_payload(req.key_b64, req.data)

@app.post("/decrypt")
def decrypt_endpoint(req: DecryptRequest):
    return get_decrypted_data(req.data_encrypted, req.key_b64)
```

## Ejecución local

- Instalar dependencias con `uv` o `pip`.
- Levantar servidor:

```bash
uvicorn main:app --reload
```

- Probar en Swagger UI: `http://localhost:8000/docs`

---

## Notas de interoperabilidad

- Clave AES:
  - Debe ser exactamente 16/24/32 bytes tras decodificar Base64.
  - Ejemplo (32 bytes): generar con `openssl rand -base64 32`.
- IV:
  - Generado aleatoriamente por `/encrypt`. Se transporta junto con el payload en el formato `iv::payload`.
- Codificación:
  - Se usa Base64 para transportar `iv` y `ciphertext` como texto.

---

## ¿Qué es el IV?

El IV (Initialization Vector) es un valor no secreto que inicializa el modo de operación del cifrado por bloques (en este caso, AES en modo CBC). Su función es asegurar que, aunque se cifre el mismo mensaje con la misma clave en diferentes ocasiones, el resultado sea distinto. Requisitos clave:
- Debe ser aleatorio y único por cada cifrado realizado con la misma clave.
- Su tamaño debe coincidir con el tamaño del bloque de AES (16 bytes).
- No necesita mantenerse en secreto y, por eso, se envía junto al ciphertext. En este proyecto va en Base64 como la primera parte del string `iv::payload`.
- Reutilizar el mismo IV con la misma clave en CBC puede filtrar información sobre el contenido y debilitar la seguridad.

## ¿Es encriptado o cifrado?

- Término correcto en español: cifrado. 
- "Encriptado" es un anglicismo ampliamente usado, pero técnicamente menos preciso. 
- En el código y en esta documentación, nos referimos a este proceso como cifrado (encrypt) y descifrado (decrypt).

Además, conviene distinguir:
- Cifrado: transforma datos legibles en ilegibles usando una clave (seguridad).
- Codificación (como Base64): transforma datos a otro formato para transporte/compatibilidad (no añade seguridad).

## ¿Qué tan robusto es este cifrado?

Resumen: El algoritmo AES es robusto; el modo CBC es seguro si se usa correctamente, pero NO ofrece autenticación/integridad. El flujo actual brinda confidencialidad, pero no detecta manipulaciones del ciphertext. Detalles:

- Algoritmo: AES (estándar industrial), con claves de 128/192/256 bits. Bien implementado, se considera seguro.
- Modo CBC: 
  - Ventajas: ampliamente conocido, seguro si se usa con IV único y padding correcto.
  - Limitaciones: no provee autenticidad ni integridad; un atacante podría alterar bits del ciphertext sin ser detectado (bit-flipping) y provocar errores de padding u obtener efectos controlados sobre el plaintext. También es susceptible a ataques de "padding oracle" si las respuestas de error filtran información.
- IV: debe ser aleatorio y único por mensaje. El endpoint cumple esto al generarlo con `get_random_bytes(16)` y adjuntarlo.
- Base64: solo es codificación para transporte; no añade seguridad.
- Gestión de claves: la robustez depende críticamente de mantener la clave secreta, con longitud válida (16/24/32 bytes) y evitando reutilización insegura. Si la clave proviene de una contraseña, debe derivarse con un KDF (p. ej., PBKDF2, scrypt, Argon2) y un salt.
- Integridad/Autenticación: actualmente no hay. Recomendado:
  - Añadir un HMAC (p. ej., HMAC-SHA-256) sobre `iv || ciphertext` y verificarlo en `/decrypt` antes de descifrar; o
  - Preferir un modo AEAD como AES-GCM o ChaCha20-Poly1305, que proporcionan confidencialidad e integridad autenticada en una sola operación.

### Recomendación práctica

- Migrar a AES-GCM: genera `nonce` (12 bytes), produce `ciphertext` + `tag` (autenticación). Formato de salida sugerido: `base64(nonce)::base64(ciphertext)::base64(tag)`.
- Si se mantiene CBC: añadir HMAC y validar antes de descifrar; normalizar errores a 400/401/422 sin filtrar detalles de padding.

---

¿Deseas que implemente AES-GCM (con soporte para tag de autenticación) o prefieres mantener CBC y añadir HMAC y validaciones? También puedo actualizar el código para usar modelos Pydantic y respuestas HTTP adecuadas, y agregar tests unitarios y ejemplos en OpenAPI.
