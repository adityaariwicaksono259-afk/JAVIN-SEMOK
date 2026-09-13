#!/data/data/com.termux/files/usr/bin/bash
cd ~/javachat || exit 1
DATE=$(date +%Y%m%d_%H%M%S)
BK="$HOME/javachat_backups"
mkdir -p "$BK"

# Backup code (kecuali node_modules + .git)
tar --exclude='node_modules' --exclude='.git' --exclude='public/uploads/*' \
    -czf "$BK/code_$DATE.tar.gz" . 2>/dev/null

# Commit ke git lokal
git add . >/dev/null 2>&1
git commit -m "backup: $DATE" >/dev/null 2>&1

SIZE=$(du -h "$BK/code_$DATE.tar.gz" | cut -f1)
echo "✅ BACKUP OK"
echo "📦 File: $BK/code_$DATE.tar.gz"
echo "📊 Size: $SIZE"

# Simpen 10 terbaru
ls -t "$BK"/code_*.tar.gz | tail -n +11 | xargs -r rm -f
