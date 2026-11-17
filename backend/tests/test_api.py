import io

import openpyxl


def test_health(client):
    r = client.get("/api/health")
    assert r.status_code == 200 and r.json()["status"] == "ok"


def test_login_wrong_password(client):
    r = client.post("/api/auth/login", data={"username": "admin", "password": "nope"})
    assert r.status_code == 401


def test_me_and_refresh(client, auth):
    r = client.get("/api/auth/me", headers=auth)
    assert r.status_code == 200 and r.json()["username"] == "admin"
    tok = client.post("/api/auth/login",
                      data={"username": "admin", "password": "admin123"}).json()
    r = client.post("/api/auth/refresh", params={"refresh_token": tok["refresh_token"]})
    assert r.status_code == 200 and r.json()["access_token"]


def test_unauthorized(client):
    assert client.get("/api/snapshot").status_code in (401, 403)


def test_snapshot_shape(client, auth, proyecto):
    r = client.get("/api/snapshot", headers=auth)
    assert r.status_code == 200
    data = r.json()
    for key in ("proyectos", "actividades", "comentarios", "subtareas", "checklist",
                "hitos", "etiquetas", "listas", "personal", "ausencias", "historial"):
        assert key in data
    assert len(data["proyectos"]) == 1


def test_proyecto_crud(client, auth, proyecto):
    pid = proyecto["id"]
    assert pid == "PRY-001"
    assert proyecto["etiqueta_1"] == "Urgente"
    r = client.put(f"/api/proyectos/{pid}", headers=auth,
                   json={"prioridad": "Alta", "etiquetas": ["Urgente", "Mejora"]})
    assert r.status_code == 200
    assert r.json()["prioridad"] == "Alta" and r.json()["etiqueta_2"] == "Mejora"
    r = client.patch(f"/api/proyectos/{pid}/estado", headers=auth,
                     json={"estado": "Completado"})
    assert r.json()["avance"] == 100
    hist = client.get("/api/historial", headers=auth,
                      params={"proyecto_id": pid}).json()
    campos = {h["campo"] for h in hist}
    assert "estado" in campos and "prioridad" in campos
    assert client.delete(f"/api/proyectos/{pid}", headers=auth).status_code == 204
    assert client.get("/api/snapshot", headers=auth).json()["proyectos"] == []


def test_proyecto_fechas_invalidas(client, auth):
    r = client.post("/api/proyectos", headers=auth, json={
        "proyecto": "X", "responsable": "Y",
        "fecha_inicio": "2026-02-01", "fecha_fin_estimada": "2026-01-01"})
    assert r.status_code == 422


def test_actividades_ciclo_y_cascada(client, auth, proyecto):
    pid = proyecto["id"]
    a1 = client.post("/api/actividades", headers=auth, json={
        "proyecto_id": pid, "actividad": "Diseño",
        "fecha_inicio": "2026-01-05", "fecha_fin": "2026-01-09"}).json()
    a2 = client.post("/api/actividades", headers=auth, json={
        "proyecto_id": pid, "actividad": "Montaje", "depende_de": a1["id"],
        "fecha_inicio": "2026-01-06", "fecha_fin": "2026-01-12"}).json()
    # el inicio se fuerza a fin de predecesor + 1
    assert a2["fecha_inicio"] == "2026-01-10"
    # ciclo rechazado
    r = client.put(f"/api/actividades/{a1['id']}", headers=auth,
                   json={"depende_de": a2["id"]})
    assert r.status_code == 422
    # mover a1 +5 días cascada a a2
    r = client.post(f"/api/actividades/{a1['id']}/move", headers=auth,
                    json={"delta_days": 5})
    assert r.status_code == 200 and r.json()["cascaded"] >= 1
    snap = client.get("/api/snapshot", headers=auth).json()
    acts = {a["id"]: a for a in snap["actividades"]}
    assert acts[a1["id"]]["fecha_fin"] == "2026-01-14"
    assert acts[a2["id"]]["fecha_inicio"] == "2026-01-15"
    # rollup de fechas del proyecto
    p = snap["proyectos"][0]
    assert p["fecha_inicio"] == "2026-01-10" and p["fecha_fin_estimada"] == "2026-01-21"


def test_max_actividades(client, auth, proyecto):
    pid = proyecto["id"]
    for i in range(10):
        r = client.post("/api/actividades", headers=auth,
                        json={"proyecto_id": pid, "actividad": f"A{i}"})
        assert r.status_code == 201
    r = client.post("/api/actividades", headers=auth,
                    json={"proyecto_id": pid, "actividad": "A11"})
    assert r.status_code == 422


def test_done_y_rollup_avance(client, auth, proyecto):
    pid = proyecto["id"]
    a1 = client.post("/api/actividades", headers=auth, json={
        "proyecto_id": pid, "actividad": "A", "peso": 3}).json()
    a2 = client.post("/api/actividades", headers=auth, json={
        "proyecto_id": pid, "actividad": "B", "peso": 1}).json()
    client.post(f"/api/actividades/{a1['id']}/done", headers=auth, json={"done": True})
    p = client.get("/api/snapshot", headers=auth).json()["proyectos"][0]
    assert p["avance"] == 75  # 3/4 ponderado
    client.post(f"/api/actividades/{a2['id']}/done", headers=auth, json={"done": True})
    p = client.get("/api/snapshot", headers=auth).json()["proyectos"][0]
    assert p["avance"] == 100 and p["estado"] == "Completado"


def test_subtareas_apply_checklist(client, auth, proyecto):
    pid = proyecto["id"]
    a = client.post("/api/actividades", headers=auth,
                    json={"proyecto_id": pid, "actividad": "A"}).json()
    s1 = client.post("/api/subtareas", headers=auth,
                     json={"actividad_id": a["id"], "texto": "s1", "horas_est": 4}).json()
    client.post("/api/subtareas", headers=auth,
                json={"actividad_id": a["id"], "texto": "s2"})
    client.put(f"/api/subtareas/{s1['id']}", headers=auth, json={"hecha": True})
    r = client.post(f"/api/actividades/{a['id']}/apply-checklist", headers=auth)
    assert r.status_code == 200 and r.json()["avance"] == 50
    assert r.json()["estado"] == "En progreso"


def test_checklist_proyecto_modo(client, auth):
    p = client.post("/api/proyectos", headers=auth, json={
        "proyecto": "Trámites", "responsable": "Ana", "modo_tareas": "Checklist"}).json()
    i1 = client.post("/api/checklist", headers=auth,
                     json={"proyecto_id": p["id"], "texto": "Permiso municipal",
                           "horas_est": 2, "demanda": "Alta"}).json()
    i2 = client.post("/api/checklist", headers=auth,
                     json={"proyecto_id": p["id"], "texto": "ART"}).json()
    client.put(f"/api/checklist/{i1['id']}", headers=auth, json={"hecha": True})
    snap = client.get("/api/snapshot", headers=auth).json()
    pr = next(x for x in snap["proyectos"] if x["id"] == p["id"])
    assert pr["avance"] == 50
    client.put(f"/api/checklist/{i2['id']}", headers=auth, json={"hecha": True})
    snap = client.get("/api/snapshot", headers=auth).json()
    pr = next(x for x in snap["proyectos"] if x["id"] == p["id"])
    assert pr["avance"] == 100 and pr["estado"] == "Completado"


def test_duplicar_proyecto(client, auth, proyecto):
    pid = proyecto["id"]
    a = client.post("/api/actividades", headers=auth, json={
        "proyecto_id": pid, "actividad": "A",
        "fecha_inicio": "2026-01-05", "fecha_fin": "2026-01-09"}).json()
    client.post("/api/actividades", headers=auth, json={
        "proyecto_id": pid, "actividad": "B", "depende_de": a["id"]})
    client.post("/api/checklist", headers=auth,
                json={"proyecto_id": pid, "texto": "item"})
    r = client.post(f"/api/proyectos/{pid}/duplicate", headers=auth)
    assert r.status_code == 201
    copy = r.json()
    assert copy["proyecto"].endswith("(copia)")
    snap = client.get("/api/snapshot", headers=auth).json()
    acts_copy = [x for x in snap["actividades"] if x["proyecto_id"] == copy["id"]]
    assert len(acts_copy) == 2
    dep = next(x for x in acts_copy if x["actividad"] == "B")["depende_de"]
    assert dep in {x["id"] for x in acts_copy}  # dependencia remapeada
    assert any(c["proyecto_id"] == copy["id"] for c in snap["checklist"])


def test_borrar_proyecto_cascada(client, auth, proyecto):
    pid = proyecto["id"]
    a = client.post("/api/actividades", headers=auth,
                    json={"proyecto_id": pid, "actividad": "A"}).json()
    client.post("/api/comentarios", headers=auth,
                json={"actividad_id": a["id"], "proyecto_id": pid,
                      "comentario": "hola", "autor": "Ana"})
    client.post("/api/hitos", headers=auth,
                json={"proyecto_id": pid, "hito": "Kickoff", "fecha": "2026-01-05"})
    client.post("/api/checklist", headers=auth,
                json={"proyecto_id": pid, "texto": "x"})
    assert client.delete(f"/api/proyectos/{pid}", headers=auth).status_code == 204
    snap = client.get("/api/snapshot", headers=auth).json()
    assert not snap["actividades"] and not snap["comentarios"]
    assert not snap["hitos"] and not snap["checklist"]


def test_etiquetas_rename_propaga(client, auth, proyecto):
    pid = proyecto["id"]
    a = client.post("/api/actividades", headers=auth,
                    json={"proyecto_id": pid, "actividad": "A", "etiqueta": "Urgente"}).json()
    t = client.post("/api/etiquetas", headers=auth,
                    json={"etiqueta": "Urgente", "categoria": "Prioridad",
                          "color_hex": "#E03131"}).json()
    r = client.put(f"/api/etiquetas/{t['id']}", headers=auth, json={"etiqueta": "Crítico"})
    assert r.status_code == 200
    snap = client.get("/api/snapshot", headers=auth).json()
    assert snap["proyectos"][0]["etiqueta_1"] == "Crítico"
    assert next(x for x in snap["actividades"] if x["id"] == a["id"])["etiqueta"] == "Crítico"
    # duplicada rechazada
    r = client.post("/api/etiquetas", headers=auth, json={"etiqueta": "crítico"})
    assert r.status_code == 422
    # borrar limpia referencias
    assert client.delete(f"/api/etiquetas/{t['id']}", headers=auth).status_code == 204
    snap = client.get("/api/snapshot", headers=auth).json()
    assert snap["proyectos"][0]["etiqueta_1"] == ""


def test_listas_rename_y_reorder(client, auth, proyecto):
    v = client.post("/api/listas", headers=auth,
                    json={"catalog": "Area", "value": "Operaciones"}).json()
    v2 = client.post("/api/listas", headers=auth,
                     json={"catalog": "Area", "value": "Mantenimiento"}).json()
    r = client.put(f"/api/listas/{v['id']}", headers=auth, json={"value": "Producción"})
    assert r.status_code == 200
    assert client.get("/api/snapshot", headers=auth).json()["proyectos"][0]["area"] == "Producción"
    r = client.post("/api/listas/reorder", headers=auth,
                    json={"catalog": "Area", "ids": [v2["id"], v["id"]]})
    assert r.status_code == 200
    assert [x["id"] for x in r.json()] == [v2["id"], v["id"]]
    r = client.post("/api/listas", headers=auth, json={"catalog": "Inexistente", "value": "x"})
    assert r.status_code == 422


def test_personal_ausencias(client, auth):
    p = client.post("/api/personal", headers=auth, json={"nombre": "Juan Pérez"}).json()
    assert p["id"] == "PER-001"
    r = client.post("/api/personal", headers=auth, json={"nombre": "juan pérez"})
    assert r.status_code == 422
    client.put(f"/api/personal/{p['id']}", headers=auth,
               json={"puesto": "Técnico", "francos_generados": 4})
    a = client.post("/api/ausencias", headers=auth, json={
        "persona_id": p["id"], "tipo": "Franco",
        "desde": "2026-01-10", "hasta": "2026-01-11"}).json()
    assert a["id"] == "AUS-0001"
    r = client.post("/api/ausencias", headers=auth, json={
        "persona_id": p["id"], "tipo": "Otro",
        "desde": "2026-01-10", "hasta": "2026-01-11"})
    assert r.status_code == 422
    r = client.post("/api/ausencias", headers=auth, json={
        "persona_id": p["id"], "tipo": "Vacaciones",
        "desde": "2026-02-10", "hasta": "2026-02-01"})
    assert r.status_code == 422
    assert client.delete(f"/api/personal/{p['id']}", headers=auth).status_code == 204
    assert client.get("/api/snapshot", headers=auth).json()["ausencias"] == []


def test_hitos_crud(client, auth, proyecto):
    pid = proyecto["id"]
    h = client.post("/api/hitos", headers=auth,
                    json={"proyecto_id": pid, "hito": "Entrega", "fecha": "2026-02-01"}).json()
    assert h["id"] == "HITO-001" and h["estado"] == "Pendiente"
    r = client.put(f"/api/hitos/{h['id']}", headers=auth, json={"estado": "Cumplido"})
    assert r.json()["estado"] == "Cumplido"
    assert client.delete(f"/api/hitos/{h['id']}", headers=auth).status_code == 204


def test_comentarios(client, auth, proyecto):
    pid = proyecto["id"]
    a = client.post("/api/actividades", headers=auth,
                    json={"proyecto_id": pid, "actividad": "A"}).json()
    c = client.post("/api/comentarios", headers=auth, json={
        "actividad_id": a["id"], "proyecto_id": pid,
        "comentario": "Revisar soldaduras", "autor": "Ana"}).json()
    r = client.put(f"/api/comentarios/{c['id']}", headers=auth,
                   json={"comentario": "Soldaduras OK"})
    assert r.json()["comentario"] == "Soldaduras OK"
    assert client.delete(f"/api/comentarios/{c['id']}", headers=auth).status_code == 204


def test_users_admin(client, auth):
    r = client.post("/api/users", headers=auth, json={
        "username": "operador", "password": "secreto1", "display_name": "Operador"})
    assert r.status_code == 201
    uid = r.json()["id"]
    tok = client.post("/api/auth/login",
                      data={"username": "operador", "password": "secreto1"}).json()
    h = {"Authorization": f"Bearer {tok['access_token']}"}
    assert client.get("/api/users", headers=h).status_code == 403
    assert client.get("/api/snapshot", headers=h).status_code == 200
    r = client.put(f"/api/users/{uid}", headers=auth, json={"is_active": False})
    assert r.json()["is_active"] is False
    r = client.post("/api/auth/login",
                    data={"username": "operador", "password": "secreto1"})
    assert r.status_code == 400


def test_excel_roundtrip(client, auth, proyecto):
    pid = proyecto["id"]
    client.post("/api/actividades", headers=auth, json={
        "proyecto_id": pid, "actividad": "A",
        "fecha_inicio": "2026-01-05", "fecha_fin": "2026-01-09"})
    client.post("/api/personal", headers=auth, json={"nombre": "Juan Pérez"})
    r = client.get("/api/excel/export", headers=auth)
    assert r.status_code == 200
    assert "spreadsheetml" in r.headers["content-type"]
    wb = openpyxl.load_workbook(io.BytesIO(r.content))
    assert "Proyectos" in wb.sheetnames and "Personal" in wb.sheetnames
    r = client.post("/api/excel/import", headers=auth,
                    files={"file": ("bd.xlsx", r.content,
                                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")})
    assert r.status_code == 200, r.text
    counts = r.json()["imported"]
    assert counts["proyectos"] == 1 and counts["actividades"] == 1
    snap = client.get("/api/snapshot", headers=auth).json()
    assert snap["proyectos"][0]["proyecto"] == "Planta Demo Compresora"
    assert snap["personal"][0]["nombre"] == "Juan Pérez"


def test_historial_clear(client, auth, proyecto):
    pid = proyecto["id"]
    client.patch(f"/api/proyectos/{pid}/estado", headers=auth, json={"estado": "Testing"})
    assert len(client.get("/api/historial", headers=auth).json()) >= 2
    assert client.delete("/api/historial", headers=auth,
                         params={"proyecto_id": pid}).status_code == 204
    assert client.get("/api/historial", headers=auth).json() == []

def test_multi_field_update_logs_each_change(client, auth, proyecto):
    pid = proyecto["id"]
    r = client.put(f"/api/proyectos/{pid}", headers=auth,
                   json={"prioridad": "Alta", "fase": "Ejecución", "sprint": "S-9"})
    assert r.status_code == 200, r.text
    r = client.put(f"/api/proyectos/{pid}/notes", headers=auth,
                   json={"comentarios": "nota", "enlaces": "Doc | https://ejemplo.com"})
    assert r.status_code == 200, r.text
    hist = client.get("/api/historial", headers=auth,
                      params={"proyecto_id": pid}).json()
    campos = {h["campo"] for h in hist}
    assert {"prioridad", "fase", "sprint", "comentarios", "enlaces"} <= campos
    assert len({h["id"] for h in hist}) == len(hist)
