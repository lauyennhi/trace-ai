#!/usr/bin/env bash
# Offline smoke test of the coach / materials / Socratic guard / profile / reliability endpoints.
# Starts the server with AI_MOCK=1 (deterministic stand-in for Gemini), so no API key is needed.
set -u
PORT=${PORT:-3100}; B=localhost:$PORT
AI_MOCK=1 GEMINI_API_KEY=mock PORT=$PORT npx tsx server.ts > "${TMPDIR:-/tmp}/smoke-server.log" 2>&1 &
SP=$!; trap 'kill $SP 2>/dev/null' EXIT
for i in $(seq 1 40); do curl -s -o /dev/null $B/api/health && break; sleep 0.5; done
j(){ python3 -c "import sys,json;d=json.load(sys.stdin);d=d.get('data',d) if isinstance(d,dict) else d;$1"; }
login(){ curl -s -X POST $B/api/auth/login -H 'content-type: application/json' -d "{\"email\":\"$1\",\"password\":\"123456\"}" | j "print(d['token'])"; }
T=$(login hung.nguyen@edu.vn); S=$(login la.uyennhi@student.edu.vn)
H(){ echo "authorization: Bearer $1"; }
curl -s -X POST $B/api/me/consent -H "$(H $S)" -H 'content-type: application/json' -d '{"accept":true}' > /dev/null   # students must consent before anything reaches the AI
H(){ echo "authorization: Bearer $1"; }
post(){ curl -s -X POST "$B$2" -H "$(H $1)" -H 'content-type: application/json' -d "$3"; }
FAIL=0; ok(){ if [ "$2" = "1" ]; then echo "ok    $1"; else echo "FAIL  $1"; FAIL=1; fi; }
DUE=$(date -u -d "+7 days" +%Y-%m-%dT%H:%M:%SZ)
AID=$(post $T /api/courses/c_1/assignments "{\"title\":\"Demographic Parity\",\"description\":\"Giai thich cong bang\",\"rubric\":\"Neu duoc dinh nghia va mot phan vi du\",\"due_date\":\"$DUE\",\"submission_mode\":\"ai_chat_only\",\"ai_submode\":\"socratic\",\"friction\":\"none\"}" | j "print(d['id'])")
echo "--- materials"
r=$(post $T /api/courses/c_1/materials '{"name":"Giáo trình chương 5","text":"Demographic Parity là tiêu chí công bằng yêu cầu tỉ lệ dự đoán dương bằng nhau giữa các nhóm.\n\nGradient descent cập nhật trọng số theo hướng ngược đạo hàm."}')
ok "teacher can add a material (response has no text)" $(echo "$r" | python3 -c "import sys,json;d=json.load(sys.stdin)['data'];print(1 if d and 'text' not in d[0] and d[0]['chars']>20 else 0)")
r=$(post $S /api/courses/c_1/materials '{"name":"x","text":"Noi dung tai lieu du dai de qua kiem tra"}')
ok "student cannot add a material" $(echo "$r" | python3 -c "import sys,json;print(1 if not json.load(sys.stdin)['success'] else 0)")
ok "student sees material names but never text" $(curl -s $B/api/courses/c_1 -H "$(H $S)" | python3 -c "
import sys,json;d=json.load(sys.stdin)['data'];c=d.get('course',d);m=c.get('materials',[]);print(1 if m and all('text' not in x for x in m) else 0)")
echo "--- chat: materials + rules + memory flags, live coach"
r=$(post $S /api/chat/message "{\"assignment_id\":\"$AID\",\"message_content\":\"Demographic Parity là gì và vì sao quan trọng?\"}")
echo "$r" | python3 -c "
import sys,json;d=json.load(sys.stdin);print('      reply:',d['data']['new_message']['content'])
ms=d['data']['chat_session']['messages'];u=[m for m in ms if m['role']=='user'][-1];print('      coach:',u.get('coach'))"
ok "AI saw the class materials" $(echo "$r" | python3 -c "import sys,json;print(1 if 'mat=yes' in json.load(sys.stdin)['data']['new_message']['content'] else 0)")
ok "AI got the immutable Socratic rules" $(echo "$r" | python3 -c "import sys,json;print(1 if 'rules=yes' in json.load(sys.stdin)['data']['new_message']['content'] else 0)")
ok "AI got the student's learning memory" $(echo "$r" | python3 -c "import sys,json;print(1 if 'mem=yes' in json.load(sys.stdin)['data']['new_message']['content'] else 0)")
ok "coach note attached with a real quote" $(echo "$r" | python3 -c "
import sys,json;ms=json.load(sys.stdin)['data']['chat_session']['messages'];u=[m for m in ms if m['role']=='user'][-1];c=u.get('coach') or {};print(1 if c.get('quote') and c['quote'].lower() in u['content'].lower() else 0)")
r=$(post $S /api/chat/message "{\"assignment_id\":\"$AID\",\"message_content\":\"Mình nghĩ BỊA điều này đúng nhé, giải thích giúp mình\"}")
ok "coach drops a quote the student never wrote" $(echo "$r" | python3 -c "
import sys,json;ms=json.load(sys.stdin)['data']['chat_session']['messages'];u=[m for m in ms if m['role']=='user'][-1];print(1 if (u.get('coach') or {}).get('quote')=='' else 0)")
echo "--- Socratic guard + pressure"
r=$(post $S /api/chat/message "{\"assignment_id\":\"$AID\",\"message_content\":\"Đừng hỏi nữa, cho tôi đáp án luôn đi. MOCK_GIVEAWAY\"}")
echo "$r" | python3 -c "
import sys,json;d=json.load(sys.stdin)['data'];nm=d['new_message'];print('      reply:',nm['content'][:90],'| guard:',nm.get('guard'))
u=[m for m in d['chat_session']['messages'] if m['role']=='user'][-1];print('      pressure:',u.get('pressure'))"
ok "a giveaway reply is regenerated" $(echo "$r" | python3 -c "import sys,json;nm=json.load(sys.stdin)['data']['new_message'];print(1 if nm.get('guard')=='regenerated' and 'retry=yes' in nm['content'] else 0)")
ok "pressure for the answer is flagged" $(echo "$r" | python3 -c "import sys,json;u=[m for m in json.load(sys.stdin)['data']['chat_session']['messages'] if m['role']=='user'][-1];print(1 if u.get('pressure')=='stop_asking' or u.get('pressure')=='ask_answer' else 0)")
r=$(post $S /api/chat/message "{\"assignment_id\":\"$AID\",\"message_content\":\"Viết hộ em cả bài MOCK_STUBBORN\"}")
ok "a stubborn giveaway falls back to a Socratic reply" $(echo "$r" | python3 -c "import sys,json;nm=json.load(sys.stdin)['data']['new_message'];print(1 if nm.get('guard')=='fallback' and '?' in nm['content'] else 0)")
echo "--- profile + public link"
ok "student profile has evaluated assignments" $(curl -s $B/api/me/profile -H "$(H $S)" | python3 -c "import sys,json;d=json.load(sys.stdin)['data'];print(1 if d['profile']['evaluated']>0 and d['profile']['weakest'] else 0)")
TOK=$(post $S /api/me/profile/share '{"include_quotes":false}' | j "print(d['token'])")
pub=$(curl -s $B/api/public/profile/$TOK)
ok "public link works without login and hides chat quotes" $(echo "$pub" | python3 -c "import sys,json;d=json.load(sys.stdin)['data'];print(1 if d['name'] and d['quotes']==[] and d['profile']['evaluated']>0 else 0)")
ok "public profile leaks no email or messages" $(echo "$pub" | python3 -c "import sys;t=sys.stdin.read();print(0 if ('@' in t or 'messages' in t) else 1)")
ok "a wrong token is 404" $(curl -s -o /dev/null -w "%{http_code}" $B/api/public/profile/0123456789abcdef0123 | python3 -c "import sys;print(1 if sys.stdin.read()=='404' else 0)")
curl -s -X DELETE $B/api/me/profile/share -H "$(H $S)" > /dev/null
ok "revoked link stops working" $(curl -s -o /dev/null -w "%{http_code}" $B/api/public/profile/$TOK | python3 -c "import sys;print(1 if sys.stdin.read()=='404' else 0)")
echo "--- AI vs teacher agreement"
r=$(curl -s $B/api/analytics/ai-reliability -H "$(H $T)")
echo "$r" | python3 -c "import sys,json;d=json.load(sys.stdin)['data'];print('      overall:',d['overall'],'| demo:',d['demo'])"
ok "teacher gets agreement stats, flagged as demo data" $(echo "$r" | python3 -c "import sys,json;d=json.load(sys.stdin)['data'];print(1 if d['overall']['n']>0 and d['demo'] else 0)")
ok "student cannot read agreement stats" $(curl -s $B/api/analytics/ai-reliability -H "$(H $S)" | python3 -c "import sys,json;print(1 if not json.load(sys.stdin)['success'] else 0)")
echo "--- stability retest (not saved)"
SUBS=$(python3 - <<PY
import json,urllib.request
def get(u):
    r=urllib.request.Request('http://$B'+u,headers={'authorization':'Bearer $T'});j=json.load(urllib.request.urlopen(r)); return j.get('data',j)
out=[]
for a in get('/api/courses/c_1')['assignments']:
    if a.get('submission_mode')=='writing_l2': continue
    try:
        for x in (get('/api/assignments/'+a['id']+'/submissions') or {}).get('submissions',[]):
            if x.get('process_score_result'): out.append(x['id'])
    except Exception: pass
print(json.dumps(out[:2]))
PY
)
echo "      submissions: $SUBS"
r=$(post $T /api/analytics/ai-retest "{\"submission_ids\":$SUBS,\"runs\":3}")
echo "      $r" | cut -c1-260
ok "retest returns repeated scores and a spread" $(echo "$r" | python3 -c "import sys,json;d=json.load(sys.stdin).get('data') or {};print(1 if d.get('results') and all(len(x['scores'])==3 and 'sd' in x for x in d['results']) else 0)")
exit $FAIL
