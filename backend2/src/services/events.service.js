/**
 * Real-Time Event Broadcaster using Server-Sent Events (SSE)
 * Allows frontend clients, farmer passes, and admin screens to receive live queue updates.
 */

class EventsService {
  constructor() {
    this.clients = new Set();
  }

  /**
   * Register a new SSE client
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   */
  addClient(req, res) {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*'
    });

    const clientId = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const centerFilter = req.query.centerId || null;

    const client = {
      id: clientId,
      res,
      centerId: centerFilter
    };

    this.clients.add(client);

    // Initial connection acknowledgment
    res.write(`data: ${JSON.stringify({ event: 'connected', clientId, timestamp: new Date().toISOString() })}\n\n`);

    // Heartbeat every 25s to prevent timeouts
    const heartbeatTimer = setInterval(() => {
      res.write(`: heartbeat\n\n`);
    }, 25000);

    req.on('close', () => {
      clearInterval(heartbeatTimer);
      this.clients.delete(client);
    });
  }

  /**
   * Broadcast an event to connected clients
   * @param {string} eventName
   * @param {object} data
   * @param {string|null} centerId Optional filter
   */
  broadcast(eventName, data, centerId = null) {
    const payload = JSON.stringify({
      event: eventName,
      centerId,
      data,
      timestamp: new Date().toISOString()
    });

    for (const client of this.clients) {
      if (!centerId || !client.centerId || client.centerId === centerId) {
        try {
          client.res.write(`data: ${payload}\n\n`);
        } catch {
          this.clients.delete(client);
        }
      }
    }
  }
}

export const eventsService = new EventsService();
export default eventsService;
