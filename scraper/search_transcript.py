import json
import sys

sys.stdout.reconfigure(encoding='utf-8')
log_path = r'C:\Users\kauan\.gemini\antigravity-ide\brain\0f7e109e-84b5-4bde-b347-8452e8db57e0\.system_generated\logs\transcript.jsonl'
with open(log_path, 'r', encoding='utf-8') as f:
    for i, line in enumerate(f):
        if '"type":"USER_INPUT"' in line:
            obj = json.loads(line)
            content = obj.get('content', '')
            if any(k in content.lower() for k in ['chuteira', 'foto', 'sapatilha', 'senha', 'hoka', 'burj']):
                print(f"=== MATCH AT LINE {i} ===")
                print(content[:1500])
                print("\n" + "-"*40)
