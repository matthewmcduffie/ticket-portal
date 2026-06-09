import { getDB } from '../../config/database.js';

export async function equipmentEnabled() {
  const db = getDB();
  const r = await db.query(`SELECT value FROM app_settings WHERE key = 'equipment_requests_enabled'`);
  return r.rows[0]?.value === 'true';
}

async function logEvent(db, { requestId, userId, userName, eventType, detail }) {
  await db.query(
    `INSERT INTO equipment_request_events (request_id, user_id, user_name, event_type, detail)
     VALUES ($1, $2, $3, $4, $5)`,
    [requestId, userId || null, userName || 'Admin', eventType, detail || null]
  );
}

export async function listRequests() {
  const db = getDB();
  const r = await db.query(`SELECT * FROM equipment_requests ORDER BY created_at DESC`);
  return r.rows;
}

export async function createRequest({ hireName, hireDepartment, hireStartDate, requestorName, items, dueDate, notes, createdBy, createdByName }) {
  const db = getDB();
  const r = await db.query(
    `INSERT INTO equipment_requests
       (hire_name, hire_department, hire_start_date, requestor_name, items, due_date, notes, created_by, created_by_name)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [hireName, hireDepartment, hireStartDate, requestorName, items, dueDate, notes || null, createdBy, createdByName]
  );
  const req = r.rows[0];
  await logEvent(db, {
    requestId: req.id,
    userId: createdBy,
    userName: createdByName,
    eventType: 'created',
    detail: `Request created for ${hireName}`,
  });
  return req;
}

export async function getRequestById(id) {
  const db = getDB();
  const r = await db.query(`SELECT * FROM equipment_requests WHERE id = $1`, [id]);
  return r.rows[0] || null;
}

export async function updateRequest(id, updates, { userId, userName }) {
  const db = getDB();
  const current = await getRequestById(id);
  if (!current) return null;

  const allowed = ['hire_name', 'hire_department', 'hire_start_date', 'requestor_name', 'items', 'due_date', 'status', 'notes'];
  const fields = [];
  const values = [];

  for (const key of allowed) {
    if (updates[key] !== undefined) {
      values.push(updates[key]);
      fields.push(`${key} = $${values.length}`);
    }
  }

  if (!fields.length) return current;
  values.push(id);

  const r = await db.query(
    `UPDATE equipment_requests SET ${fields.join(', ')}, updated_at = NOW() WHERE id = $${values.length} RETURNING *`,
    values
  );
  const updated = r.rows[0];

  if (updates.status && updates.status !== current.status) {
    await logEvent(db, {
      requestId: id, userId, userName, eventType: 'status_change',
      detail: `Status changed from ${current.status} to ${updates.status}`,
    });
  }

  const editableFields = ['hire_name', 'hire_department', 'hire_start_date', 'requestor_name', 'items', 'due_date', 'notes'];
  const changedFields = editableFields.filter(f => {
    if (updates[f] === undefined) return false;
    return JSON.stringify(updates[f]) !== JSON.stringify(current[f]);
  });

  if (changedFields.length > 0) {
    await logEvent(db, {
      requestId: id, userId, userName, eventType: 'field_edit',
      detail: changedFields.map(f => f.replace(/_/g, ' ')).join(', ') + ' updated',
    });
  }

  return updated;
}

export async function deleteRequest(id) {
  const db = getDB();
  await db.query(`DELETE FROM equipment_requests WHERE id = $1`, [id]);
}

export async function getEvents(requestId) {
  const db = getDB();
  const r = await db.query(
    `SELECT * FROM equipment_request_events WHERE request_id = $1 ORDER BY created_at ASC`,
    [requestId]
  );
  return r.rows;
}

export async function addComment(requestId, { userId, userName, detail }) {
  const db = getDB();
  await logEvent(db, { requestId, userId, userName, eventType: 'comment', detail });
}
