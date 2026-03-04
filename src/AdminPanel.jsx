import { useState, useEffect, useCallback } from 'react'
import * as api from './api'

export default function AdminPanel({ currentUserEmail }) {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [addEmail, setAddEmail] = useState('')
  const [addRole, setAddRole] = useState('user')
  const [adding, setAdding] = useState(false)
  const [deletingEmail, setDeletingEmail] = useState(null)
  const [toast, setToast] = useState(null)

  const showToast = useCallback((msg, err = false) => {
    setToast({ msg, err })
    setTimeout(() => setToast(null), 3500)
  }, [])

  const loadUsers = useCallback(async () => {
    try {
      setLoading(true)
      const data = await api.fetchUsers()
      setUsers(data)
    } catch (e) {
      showToast(`Error cargando usuarios: ${e.message}`, true)
    } finally {
      setLoading(false)
    }
  }, [showToast])

  useEffect(() => { loadUsers() }, [loadUsers])

  const handleAdd = async (e) => {
    e.preventDefault()
    const email = addEmail.trim().toLowerCase()
    if (!email) return
    try {
      setAdding(true)
      await api.addUser(email, addRole)
      setAddEmail('')
      setAddRole('user')
      showToast(`Usuario ${email} agregado como ${addRole}`)
      await loadUsers()
    } catch (err) {
      showToast(`Error: ${err.message}`, true)
    } finally {
      setAdding(false)
    }
  }

  const handleDelete = async (email) => {
    if (!confirm(`¿Eliminar a ${email}?`)) return
    try {
      setDeletingEmail(email)
      await api.deleteUser(email)
      showToast(`Usuario ${email} eliminado`)
      await loadUsers()
    } catch (err) {
      showToast(`Error: ${err.message}`, true)
    } finally {
      setDeletingEmail(null)
    }
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return '—'
    try {
      return new Date(dateStr).toLocaleDateString('es-CL', {
        day: '2-digit', month: 'short', year: 'numeric'
      })
    } catch {
      return '—'
    }
  }

  return (
    <div className="admin-panel">
      <div className="admin-header">
        <div>
          <h2 className="admin-title">Gestión de Usuarios</h2>
          <p className="admin-subtitle">{users.length} usuario{users.length !== 1 ? 's' : ''} autorizado{users.length !== 1 ? 's' : ''}</p>
        </div>
        <button className="admin-refresh-btn" onClick={loadUsers} disabled={loading}>
          Actualizar
        </button>
      </div>

      {/* Add user form */}
      <form className="admin-add-form" onSubmit={handleAdd}>
        <input
          className="admin-input"
          type="email"
          placeholder="email@ejemplo.com"
          value={addEmail}
          onChange={e => setAddEmail(e.target.value)}
          required
          disabled={adding}
        />
        <select
          className="admin-select"
          value={addRole}
          onChange={e => setAddRole(e.target.value)}
          disabled={adding}
        >
          <option value="user">Usuario</option>
          <option value="admin">Admin</option>
        </select>
        <button className="admin-add-btn" type="submit" disabled={adding || !addEmail.trim()}>
          {adding ? 'Agregando...' : 'Agregar'}
        </button>
      </form>

      {/* Users table */}
      {loading ? (
        <div className="admin-loading">
          <div className="spinner-ring" />
          <span>Cargando usuarios...</span>
        </div>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Email</th>
                <th>Rol</th>
                <th className="admin-col-date">Agregado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => {
                const isSelf = u.email.toLowerCase() === currentUserEmail?.toLowerCase()
                return (
                  <tr key={u.email} className={isSelf ? 'admin-row-self' : ''}>
                    <td className="admin-cell-email">
                      {u.email}
                      {isSelf && <span className="admin-you-badge">Tú</span>}
                    </td>
                    <td>
                      <span className={`admin-role-badge ${u.role === 'admin' ? 'admin-role-admin' : 'admin-role-user'}`}>
                        {u.role === 'admin' ? 'Admin' : 'Usuario'}
                      </span>
                    </td>
                    <td className="admin-col-date">{formatDate(u.addedAt)}</td>
                    <td className="admin-cell-actions">
                      {!isSelf && (
                        <button
                          className="admin-delete-btn"
                          onClick={() => handleDelete(u.email)}
                          disabled={deletingEmail === u.email}
                        >
                          {deletingEmail === u.email ? '...' : 'Eliminar'}
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className={`admin-toast ${toast.err ? 'admin-toast-err' : ''}`}>
          {toast.msg}
        </div>
      )}
    </div>
  )
}
