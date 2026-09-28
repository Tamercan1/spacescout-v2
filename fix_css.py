import io

with io.open('frontend/src/index.css', 'rb') as f:
    data = f.read()

# Fix encoded weirdness (null bytes and weird spacing)
clean_data = data.replace(b'\x00', b'')

# Find the end of the mobile media query
idx = clean_data.find(b'pointer-events: auto;\n  }\n}')
if idx == -1:
    idx = clean_data.find(b'pointer-events: auto;\r\n  }\r\n}')
if idx == -1:
    idx = clean_data.find(b'pointer-events: auto;\r\n  }\n}')

if idx != -1:
    # We found the end marker, keep up to there + the closing braces
    end_str = clean_data[idx:idx+30]
    brace_idx = end_str.find(b'}', end_str.find(b'}') + 1)
    if brace_idx != -1:
        clean_data = clean_data[:idx + brace_idx + 1] + b'\n'
    
with io.open('frontend/src/index.css', 'wb') as f:
    f.write(clean_data)
