import re
import os
import colorsys

tailwind_path = r'c:\Users\nikhi\Videos\ParkSystem\smart_parking_react\tailwind.config.js'
css_path = r'c:\Users\nikhi\Videos\ParkSystem\smart_parking_react\src\index.css'

with open(tailwind_path, 'r', encoding='utf-8') as f:
    tailwind_content = f.read()

# Extract colors block
color_pattern = r'colors:\s*\{([^}]+)\}'
match = re.search(color_pattern, tailwind_content)
if not match:
    print("Could not find colors in tailwind.config.js")
    exit(1)

colors_block = match.group(1)
color_lines = colors_block.split(',')

new_colors_block = []
root_vars = []
dark_vars = []

def hex_to_rgb(hex_code):
    hex_code = hex_code.lstrip('#')
    return tuple(int(hex_code[i:i+2], 16) for i in (0, 2, 4))

def rgb_to_hex(rgb):
    return '#{:02x}{:02x}{:02x}'.format(int(rgb[0]), int(rgb[1]), int(rgb[2]))

def invert_lightness(hex_code):
    rgb = hex_to_rgb(hex_code)
    h, l, s = colorsys.rgb_to_hls(rgb[0]/255.0, rgb[1]/255.0, rgb[2]/255.0)
    
    # Invert lightness (1.0 - l), but keep it within bounds and avoid making things exactly 50% gray if they were extreme
    new_l = 1.0 - l
    
    # Material Design dark themes usually have very dark backgrounds and light text
    # We add a slight bias to make darks darker and lights lighter
    if new_l < 0.2: new_l = max(0.05, new_l - 0.05)
    if new_l > 0.8: new_l = min(0.95, new_l + 0.05)
    
    new_rgb = colorsys.hls_to_rgb(h, new_l, s)
    return rgb_to_hex([c * 255 for c in new_rgb])

for line in color_lines:
    if not line.strip(): continue
    parts = line.split(':')
    if len(parts) == 2:
        name = parts[0].strip().strip('"').strip("'")
        hex_val = parts[1].strip().strip('"').strip("'")
        
        # Add to tailwind config replacement
        new_colors_block.append(f'        "{name}": "var(--color-{name})"')
        
        # Add to CSS root
        root_vars.append(f'  --color-{name}: {hex_val};')
        
        # Generate dark mode color
        dark_hex = invert_lightness(hex_val)
        dark_vars.append(f'  --color-{name}: {dark_hex};')

new_tailwind = tailwind_content.replace(match.group(0), "colors: {\n" + ",\n".join(new_colors_block) + "\n      }")

with open(tailwind_path, 'w', encoding='utf-8') as f:
    f.write(new_tailwind)

with open(css_path, 'r', encoding='utf-8') as f:
    css_content = f.read()

css_append = "\n:root {\n" + "\n".join(root_vars) + "\n}\n\n.dark {\n" + "\n".join(dark_vars) + "\n}\n"

with open(css_path, 'w', encoding='utf-8') as f:
    f.write(css_content + css_append)

print("Successfully generated dark mode colors!")
