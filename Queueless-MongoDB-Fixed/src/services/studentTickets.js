// Support both the current API and older MongoDB/populated-owner responses.
export function studentTickets(tickets, user) {
  const identifiers = [user?.id, user?._id, user?.email]
    .filter(value => typeof value === 'string' && value.trim())
    .map(value => value.trim().toLowerCase())

  return (Array.isArray(tickets) ? tickets : []).filter(ticket => {
    const owner = ticket.studentId
    const ownerIds = typeof owner === 'object' && owner
      ? [owner.id, owner._id, owner.email]
      : [owner]
    return ownerIds.some(value => typeof value === 'string' && identifiers.includes(value.trim().toLowerCase()))
  }).map(ticket => ({ ...ticket, id: ticket.id || ticket._id }))
}
