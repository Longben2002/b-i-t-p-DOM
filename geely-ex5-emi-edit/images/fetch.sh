#!/usr/bin/env bash
# Tải ảnh Geely EX5 EM-i / Galaxy Starship 7 từ Wikimedia Commons vào images/src/
# Cần mạng truy cập được upload.wikimedia.org
set -e
cd "$(dirname "$0")"
mkdir -p src
UA='geely-ex5-emi-edit/1.0 (video quang cao; contact: repo owner)'
curl -fsSL -A "$UA" -o 'src/Geely_EX5_EM-i_1.5_Max_PHEV_2026_(1).jpg' 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/bb/Geely_EX5_EM-i_1.5_Max_PHEV_2026_%281%29.jpg/2560px-Geely_EX5_EM-i_1.5_Max_PHEV_2026_%281%29.jpg' && echo 'ok  Geely_EX5_EM-i_1.5_Max_PHEV_2026_(1).jpg' || echo 'LỖI Geely_EX5_EM-i_1.5_Max_PHEV_2026_(1).jpg'
curl -fsSL -A "$UA" -o 'src/Geely_EX5_EM-i_1.5_Max_PHEV_2026_(2).jpg' 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/93/Geely_EX5_EM-i_1.5_Max_PHEV_2026_%282%29.jpg/2560px-Geely_EX5_EM-i_1.5_Max_PHEV_2026_%282%29.jpg' && echo 'ok  Geely_EX5_EM-i_1.5_Max_PHEV_2026_(2).jpg' || echo 'LỖI Geely_EX5_EM-i_1.5_Max_PHEV_2026_(2).jpg'
curl -fsSL -A "$UA" -o 'src/Geely_EX5_EM-i_1.5_Max_PHEV_2026_(3).jpg' 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0b/Geely_EX5_EM-i_1.5_Max_PHEV_2026_%283%29.jpg/2560px-Geely_EX5_EM-i_1.5_Max_PHEV_2026_%283%29.jpg' && echo 'ok  Geely_EX5_EM-i_1.5_Max_PHEV_2026_(3).jpg' || echo 'LỖI Geely_EX5_EM-i_1.5_Max_PHEV_2026_(3).jpg'
curl -fsSL -A "$UA" -o 'src/Geely_EX5_EM-i_1.5_Max_PHEV_2026_(4).jpg' 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b0/Geely_EX5_EM-i_1.5_Max_PHEV_2026_%284%29.jpg/2560px-Geely_EX5_EM-i_1.5_Max_PHEV_2026_%284%29.jpg' && echo 'ok  Geely_EX5_EM-i_1.5_Max_PHEV_2026_(4).jpg' || echo 'LỖI Geely_EX5_EM-i_1.5_Max_PHEV_2026_(4).jpg'
curl -fsSL -A "$UA" -o 'src/Geely_Galaxy_Starship_7_001.jpg' 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f1/Geely_Galaxy_Starship_7_001.jpg/2560px-Geely_Galaxy_Starship_7_001.jpg' && echo 'ok  Geely_Galaxy_Starship_7_001.jpg' || echo 'LỖI Geely_Galaxy_Starship_7_001.jpg'
curl -fsSL -A "$UA" -o 'src/Geely_Galaxy_Starship_7_002.jpg' 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3f/Geely_Galaxy_Starship_7_002.jpg/2560px-Geely_Galaxy_Starship_7_002.jpg' && echo 'ok  Geely_Galaxy_Starship_7_002.jpg' || echo 'LỖI Geely_Galaxy_Starship_7_002.jpg'
curl -fsSL -A "$UA" -o 'src/Geely_Galaxy_Starship_7_IMG001.jpg' 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5e/Geely_Galaxy_Starship_7_IMG001.jpg/2560px-Geely_Galaxy_Starship_7_IMG001.jpg' && echo 'ok  Geely_Galaxy_Starship_7_IMG001.jpg' || echo 'LỖI Geely_Galaxy_Starship_7_IMG001.jpg'
curl -fsSL -A "$UA" -o 'src/Geely_Galaxy_Starship_7_IMG002.jpg' 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/ea/Geely_Galaxy_Starship_7_IMG002.jpg/2560px-Geely_Galaxy_Starship_7_IMG002.jpg' && echo 'ok  Geely_Galaxy_Starship_7_IMG002.jpg' || echo 'LỖI Geely_Galaxy_Starship_7_IMG002.jpg'
curl -fsSL -A "$UA" -o 'src/Geely_Galaxy_Starship_7_IMG003.jpg' 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7b/Geely_Galaxy_Starship_7_IMG003.jpg/2560px-Geely_Galaxy_Starship_7_IMG003.jpg' && echo 'ok  Geely_Galaxy_Starship_7_IMG003.jpg' || echo 'LỖI Geely_Galaxy_Starship_7_IMG003.jpg'
