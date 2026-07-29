import os

directory = r'c:\Users\nikhi\Videos\ParkSystem\smart_parking_react\src'

replacements = {
    'bg-[#D1FAE5] text-[#065F46]': 'bg-primary-container text-on-primary-container',
    'bg-[#FEE2E2] text-[#991B1B]': 'bg-error-container text-on-error-container',
    'bg-[#DBEAFE] text-[#1E40AF]': 'bg-secondary-container text-on-secondary-container',
    'bg-[#F1F5F9] text-[#475569]': 'bg-surface-container text-on-surface-variant',
    'bg-[#f0f4f8]': 'bg-surface-dim',
    'bg-[#EBF8FF] text-[#2B6CB0]': 'bg-secondary-container text-on-secondary-container',
    'bg-[#EBF8FF]': 'bg-secondary-container',
    'text-[#2B6CB0]': 'text-on-secondary-container',
    'bg-[#F8FAFC]': 'bg-surface-container',
    'bg-[#FFF3CD] text-[#856404] border-[#FFEAA7]': 'bg-tertiary-container text-on-tertiary-container border-outline-variant',
}

for root, _, files in os.walk(directory):
    for file in files:
        if file.endswith('.jsx') or file.endswith('.css'):
            filepath = os.path.join(root, file)
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()
                
            original_content = content
            for old, new in replacements.items():
                content = content.replace(old, new)
                
            if content != original_content:
                with open(filepath, 'w', encoding='utf-8') as f:
                    f.write(content)
                print(f"Updated {file}")
