from pathlib import Path

root = Path(__file__).resolve().parent.parent
config = root / 'src' / 'apiConfig.js'
config.write_text("const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3002';\nexport default API_URL;\n")

files = [
    'src/components/AuthContext.js',
    'src/components/DataContext.js',
    'src/components/AdminNotifications.js',
    'src/components/AdminFeedback.js',
    'src/components/MenuAdmin.js',
    'src/components/Home.js',
    'src/components/StaffInventory.js',
    'src/components/StudentFeedback.js'
]

for file in files:
    path = root / file
    text = path.read_text()
    if "import API_URL from '../apiConfig';" not in text:
        lines = text.splitlines()
        insert_at = 0
        for i, line in enumerate(lines):
            if line.startswith('import '):
                insert_at = i + 1
        lines.insert(insert_at, "import API_URL from '../apiConfig';")
        text = '\n'.join(lines) + ('\n' if text.endswith('\n') else '')
    text = text.replace("const API_URL = process.env.REACT_APP_API_URL || '';\n", '')
    path.write_text(text)

print('Updated', files)
