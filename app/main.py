from fastapi import FastAPI
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from base64 import b64encode, b64decode
from Crypto.Cipher import AES
from Crypto.Util.Padding import unpad
from Crypto.Random import get_random_bytes
from Crypto.Util.Padding import pad
import json
import os

app = FastAPI()

# Mount static files
app.mount("/web", StaticFiles(directory="app/web"), name="web")


@app.get("/", response_class=HTMLResponse)
def main():
    with open("app/web/index.html", "r") as f:
        return f.read()


def decrypt_payload(key, encrypted_payload):
    print("key:", key)
    print("encrypted_payload:", encrypted_payload)
    """ Function for decrypting payload """

    iv_base64, payload_base64 = encrypted_payload.split("::")

    try:
        iv = b64decode(iv_base64)
        payload = b64decode(payload_base64)

        cipher = AES.new(key, AES.MODE_CBC, iv)
        encoded_payload = unpad(cipher.decrypt(payload), AES.block_size)

        return encoded_payload.decode("utf-8")
    except Exception as e:
        print(f"decrypt_payload error - {e}")
        return False


@app.post("/decrypt")
def get_decrypted_data(data_encrypted: str, key: str):
    """Function for decrypt"""

    print("key:", key)
    print("encrypted_payload:", data_encrypted)

    base_key = b64decode(key)
    payload = decrypt_payload(base_key, data_encrypted)

    print(
        """

    payload
    
          """,
        type(payload),
        payload,
    )

    print("""

    r

""")

    if not payload:
        return False

    return json.loads(payload)


@app.post("/encrypt")
def encrypt_payload(key, data):
    key = b64decode(key)
    """ Function for encrypting payload (inverse of decrypt_payload) """
    # Convertir el texto a bytes (si es str o dict)
    if isinstance(data, dict):
        data = json.dumps(data)
    if isinstance(data, str):
        data = data.encode("utf-8")

    # Generar IV aleatorio
    iv = get_random_bytes(AES.block_size)

    # Crear el cifrador AES CBC
    cipher = AES.new(key, AES.MODE_CBC, iv)

    # Cifrar con padding
    encrypted = cipher.encrypt(pad(data, AES.block_size))

    # Codificar ambos en Base64
    iv_base64 = b64encode(iv).decode("utf-8")
    payload_base64 = b64encode(encrypted).decode("utf-8")

    # Unir con '::' para que decrypt_payload pueda separarlo
    return f"{iv_base64}::{payload_base64}"


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
