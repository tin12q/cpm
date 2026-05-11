/**
 * Min-Cost Max-Flow Algorithm Implementation
 * Sử dụng Successive Shortest Path Algorithm với Bellman-Ford
 */

class MinCostMaxFlow {
	constructor() {
		this.graph = {};
		this.source = null;
		this.sink = null;
	}

	/**
	 * Khởi tạo graph từ dữ liệu
	 * @param {Object} graphData - Graph data với nodes và edges
	 */
	initializeGraph(graphData) {
		this.graph = {};

		// Khởi tạo adjacency list
		graphData.nodes.forEach((node) => {
			this.graph[node.id] = {
				neighbors: [],
				data: node.data,
			};
		});

		// Thêm edges
		graphData.edges.forEach((edge, index) => {
			// Forward edge
			this.graph[edge.from].neighbors.push({
				to: edge.to,
				capacity: edge.capacity,
				cost: edge.cost,
				flow: 0,
				id: `edge_${index}`,
				reverse: `edge_${index}_reverse`,
			});

			// Reverse edge (residual)
			this.graph[edge.to].neighbors.push({
				to: edge.from,
				capacity: 0,
				cost: -edge.cost,
				flow: 0,
				id: `edge_${index}_reverse`,
				reverse: `edge_${index}`,
			});
		});

		// Xác định source và sink
		this.source = graphData.nodes.find((n) => n.type === "source")?.id;
		this.sink = graphData.nodes.find((n) => n.type === "sink")?.id;
	}

	/**
	 * Tìm shortest path từ source đến sink sử dụng Bellman-Ford
	 * @returns {Object|null} - {path, cost} hoặc null nếu không tìm thấy
	 */
	findShortestPath() {
		const dist = {};
		const parent = {};
		const parentEdge = {};

		// Khởi tạo distances
		Object.keys(this.graph).forEach((node) => {
			dist[node] = Infinity;
			parent[node] = null;
			parentEdge[node] = null;
		});
		dist[this.source] = 0;

		// Bellman-Ford: relax edges V-1 times
		const nodes = Object.keys(this.graph);
		for (let i = 0; i < nodes.length - 1; i++) {
			for (const from of nodes) {
				if (dist[from] === Infinity) continue;

				for (const edge of this.graph[from].neighbors) {
					// Chỉ xét edges còn capacity
					if (edge.capacity > edge.flow) {
						const newDist = dist[from] + edge.cost;
						if (newDist < dist[edge.to]) {
							dist[edge.to] = newDist;
							parent[edge.to] = from;
							parentEdge[edge.to] = edge;
						}
					}
				}
			}
		}

		// Không tìm thấy đường đi
		if (dist[this.sink] === Infinity) {
			return null;
		}

		// Reconstruct path
		const path = [];
		let current = this.sink;
		while (current !== this.source) {
			path.unshift({
				from: parent[current],
				to: current,
				edge: parentEdge[current],
			});
			current = parent[current];
		}

		return {
			path: path,
			cost: dist[this.sink],
		};
	}

	/**
	 * Tìm minimum capacity trên path
	 * @param {Array} path - Đường đi
	 * @returns {number} - Minimum capacity
	 */
	findMinCapacity(path) {
		let minCapacity = Infinity;
		for (const step of path) {
			const remainingCapacity = step.edge.capacity - step.edge.flow;
			minCapacity = Math.min(minCapacity, remainingCapacity);
		}
		return minCapacity;
	}

	/**
	 * Tìm reverse edge
	 * @param {string} from - From node
	 * @param {string} edgeId - Edge ID
	 * @returns {Object} - Reverse edge
	 */
	findReverseEdge(from, edgeId) {
		return this.graph[from].neighbors.find((e) => e.id === edgeId);
	}

	/**
	 * Augment flow trên path
	 * @param {Array} path - Đường đi
	 * @param {number} flow - Flow cần augment
	 */
	augmentFlow(path, flow) {
		for (const step of path) {
			// Tăng flow trên forward edge
			step.edge.flow += flow;

			// Tăng capacity trên reverse edge
			const reverseEdge = this.findReverseEdge(step.to, step.edge.reverse);
			if (reverseEdge) {
				reverseEdge.capacity += flow;
			}
		}
	}

	/**
	 * Chạy Min-Cost Max-Flow algorithm
	 * @returns {Object} - {maxFlow, minCost, assignments}
	 */
	solve() {
		let maxFlow = 0;
		let minCost = 0;

		while (true) {
			const result = this.findShortestPath();

			if (!result) {
				// Không còn augmenting path
				break;
			}

			const flow = this.findMinCapacity(result.path);
			this.augmentFlow(result.path, flow);

			maxFlow += flow;
			minCost += flow * result.cost;
		}

		// Trích xuất assignments
		const assignments = this.extractAssignments();

		return {
			maxFlow: maxFlow,
			minCost: minCost,
			assignments: assignments,
		};
	}

	/**
	 * Trích xuất kết quả assignment từ flow graph
	 * @returns {Object} - {taskId: [userId1, userId2, ...]}
	 */
	extractAssignments() {
		const assignments = {};

		// Duyệt qua tất cả các nodes
		Object.keys(this.graph).forEach((nodeId) => {
			const node = this.graph[nodeId];

			// Chỉ xét user nodes
			if (node.data && node.data.email) {
				// User có email
				// Duyệt qua các edges từ user
				node.neighbors.forEach((edge) => {
					// Nếu edge có flow > 0 và đi đến task (không phải source/sink)
					if (edge.flow > 0 && edge.to !== "source" && edge.to !== "sink") {
						const taskNode = this.graph[edge.to];
						// Kiểm tra xem đó có phải là task node không
						if (taskNode.data && taskNode.data.title) {
							// Task có title
							if (!assignments[edge.to]) {
								assignments[edge.to] = [];
							}
							assignments[edge.to].push(nodeId);
						}
					}
				});
			}
		});

		return assignments;
	}
}

/**
 * Wrapper function để chạy Min-Cost Max-Flow
 * @param {Object} graphData - Graph data structure
 * @returns {Object} - Result với maxFlow, minCost, assignments
 */
function runMinCostMaxFlow(graphData) {
	const mcmf = new MinCostMaxFlow();
	mcmf.initializeGraph(graphData);
	return mcmf.solve();
}

module.exports = {
	MinCostMaxFlow,
	runMinCostMaxFlow,
};
