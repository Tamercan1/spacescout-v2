import os

filename = 'frontend/src/index.css'

with open(filename, 'rb') as f:
    content = f.read()

# Replace UTF-16 LE null bytes
content = content.replace(b'\x00', b'')

with open(filename, 'wb') as f:
    f.write(content)
