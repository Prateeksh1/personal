// --- KanbanAPI, read(), and save() functions ---
// UPDATED: These functions are now more robust to handle all new features.
const KanbanAPI = {
 getBoard() {
 return read();
 },
 addColumn(title) {
 const data = read();
 const newColumn = {
 id: Math.floor(Math.random() * 1000000),
 title,
 tasks: []
 };
 data.push(newColumn);
 save(data);
 return newColumn;
 },
 renameColumn(columnId, newTitle) {
 const data = read();
 const column = data.find(col => col.id == columnId);
 if (column) {
 column.title = newTitle;
 save(data);
 }
 },
 deleteColumn(columnId) {
 const data = read().filter(col => col.id != columnId);
 save(data);
 },
 updateColumnOrder(newOrder) {
 const data = read();
 const orderedData = newOrder.map(columnId => {
 return data.find(column => column.id == columnId);
 });
 save(orderedData);
 },
 insertTask(columnId, props) {
 const data = read();
 const column = data.find(col => col.id == columnId);
 if (!column) throw new Error("Column does not exist.");
 const newTask = {
 id: Math.floor(Math.random() * 1000000),
 content: props.content,
 description: props.description || '',
 dueDate: props.dueDate || '',
 priority: props.priority || 'medium',
 checklist: props.checklist || [] // Add checklist
 };
 column.tasks.push(newTask);
 save(data);
 return newTask;
 },
 updateTask(taskId, newProps) {
 const data = read();
 const [task, currentColumn] = (() => {
 for (const column of data) {
 const task = column.tasks.find(t => t.id == taskId);
 if (task) return [task, column];
 }
 return [null, null];
 })();
 if (!task) throw new Error("Task not found.");
 for (let prop in newProps) {
 if (newProps[prop] !== undefined) {
 task[prop] = newProps[prop];
 }
 }
 if (newProps.columnId && newProps.columnId != currentColumn.id) {
 currentColumn.tasks.splice(currentColumn.tasks.indexOf(task), 1);
 data.find(col => col.id == newProps.columnId).tasks.push(task);
 }
 if (newProps.taskOrder) {
 const column = data.find(col => col.id == newProps.columnId);
 column.tasks.sort((a, b) => {
 return newProps.taskOrder.indexOf(a.id) - newProps.taskOrder.indexOf(b.id);
 });
 }
 save(data);
 },
 deleteTask(taskId) {
 const data = read();
 for (const column of data) {
 const taskIndex = column.tasks.findIndex(t => t.id == taskId);
 if (taskIndex > -1) {
 column.tasks.splice(taskIndex, 1);
 break;
 }
 }
 save(data);
 }
};

function read() {
 const json = localStorage.getItem("kanban-data");
 if (!json) {
 // Default structure if nothing in storage
 return [
 { id: 1, title: "Backlog", tasks: [] },
 { id: 2, title: "In Progress", tasks: [] },
 { id: 3, title: "Done", tasks: [] }
 ];
 }
 return JSON.parse(json);
}

function save(data) {
 localStorage.setItem("kanban-data", JSON.stringify(data));
}


// --- VIEW LOGIC --- //
const board = document.querySelector(".kanban-board");
const overlay = document.getElementById("modal-overlay");
const detailsModal = document.getElementById("details-modal");
const detailsBody = document.getElementById("details-body");
const detailsTitle = document.getElementById("details-title");
const editTaskBtn = document.getElementById("edit-task-btn");
const formModal = document.getElementById("form-modal");
const form = document.getElementById("task-form");
const formModalTitle = document.getElementById("form-modal-title");
const dashboardModal = document.getElementById("dashboard-modal");


function renderBoard() {
 board.innerHTML = ""; // Clear board
 const boardData = KanbanAPI.getBoard();

 boardData.forEach((columnData, index) => {
 const columnEl = createColumnElement(columnData, index);
 board.appendChild(columnEl);
 });

 // Make columns draggable
 const columns = board.querySelectorAll('.kanban-column');
 columns.forEach(column => {
 column.addEventListener('dragstart', e => {
 if (e.target.classList.contains('kanban-column')) {
 e.dataTransfer.setData('text/plain', column.dataset.columnId);
 column.classList.add('dragging');
 }
 });
 column.addEventListener('dragend', e => {
 if (e.target.classList.contains('kanban-column')) {
 column.classList.remove('dragging');
 }
 });
 });

 board.addEventListener('dragover', e => {
 e.preventDefault();
 const draggingColumn = document.querySelector('.kanban-column.dragging');
 if (draggingColumn) {
 const afterElement = getDragAfterElement(board, e.clientX, '.kanban-column');
 if (afterElement == null) {
 board.appendChild(draggingColumn);
 } else {
 board.insertBefore(draggingColumn, afterElement);
 }
 }
 });

 board.addEventListener('drop', e => {
 const draggingColumn = document.querySelector('.kanban-column.dragging');
 if (draggingColumn) {
 const newColumnOrder = Array.from(board.querySelectorAll('.kanban-column')).map(col => Number(col.dataset.columnId));
 KanbanAPI.updateColumnOrder(newColumnOrder);
 renderBoard(); // Re-render to apply color classes correctly
 }
 });
}

function createColumnElement(columnData, index) {
 const columnEl = document.createElement("div");
 const colorClass = `kanban-column-color-${(index % 4) + 1}`;
 columnEl.className = `kanban-column ${colorClass}`;
 columnEl.dataset.columnId = columnData.id;
 columnEl.draggable = true;

 columnEl.innerHTML = `
 <div class="column-header">
 <h2 class="column-title">${columnData.title}</h2>
 <div class="column-header-controls">
 <button class="add-task-btn"><i class="fas fa-plus"></i></button>
 <button class="delete-column-btn"><i class="fas fa-trash-alt"></i></button>
 </div>
 </div>
 <div class="tasks-container"></div>
 `;

 const tasksContainer = columnEl.querySelector(".tasks-container");
 columnData.tasks.forEach(task => {
 tasksContainer.appendChild(createTaskElement(task));
 });

 tasksContainer.addEventListener("dragover", e => {
 e.preventDefault();
 const afterElement = getDragAfterElement(tasksContainer, e.clientY, '.task-card');
 const draggingCard = document.querySelector('.task-card.dragging');
 if (draggingCard) {
 if (afterElement == null) {
 tasksContainer.appendChild(draggingCard);
 } else {
 tasksContainer.insertBefore(draggingCard, afterElement);
 }
 }
 });

 tasksContainer.addEventListener("drop", e => {
 e.preventDefault();
 const taskId = e.dataTransfer.getData("text/plain");
 if (taskId) {
 const taskOrder = Array.from(tasksContainer.querySelectorAll('.task-card')).map(card => Number(card.dataset.taskId));
 taskOrder.push(Number(taskId)); // Add dropped task if not already present
 const uniqueOrder = [...new Set(taskOrder)];
 KanbanAPI.updateTask(taskId, { columnId: columnData.id, taskOrder: uniqueOrder });
 renderBoard();
 }
 });
 return columnEl;
}


function createTaskElement(task) {
 const taskEl = document.createElement("div");
 taskEl.className = `task-card ${task.priority}`;
 taskEl.dataset.taskId = task.id;
 taskEl.dataset.content = `${task.content.toLowerCase()} ${task.description?.toLowerCase() || ''}`;
 taskEl.draggable = true;
 const formattedDueDate = task.dueDate ? new Date(task.dueDate).toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }) : '';

 const checklistProgress = task.checklist && task.checklist.length > 0
 ? `<div class="checklist-progress-container">
 <i class="fas fa-check-square"></i>
 <span>${task.checklist.filter(i => i.completed).length}/${task.checklist.length}</span>
 <div class="progress-bar">
 <div class="progress-bar-fill" style="width: ${(task.checklist.filter(i => i.completed).length / task.checklist.length) * 100}%"></div>
 </div>
 </div>`
 : '';

 taskEl.innerHTML = `
 <div class="task-card-header">
 <span class="task-title">${task.content}</span>
 <button class="task-delete-btn"><i class="fas fa-trash-alt"></i></button>
 </div>
 ${checklistProgress}
 <div class="task-footer">
 ${formattedDueDate ? `<span><i class="far fa-calendar-alt"></i> ${formattedDueDate}</span>` : '<span></span>'}
 <span class="task-priority">${task.priority}</span>
 </div>
 `;

 taskEl.addEventListener("dragstart", e => {
 e.stopPropagation();
 e.dataTransfer.setData("text/plain", task.id);
 taskEl.classList.add("dragging");
 });
 taskEl.addEventListener("dragend", () => taskEl.classList.remove("dragging"));
 taskEl.addEventListener("click", e => {
 if (!e.target.closest(".task-delete-btn")) {
 openDetailsView(task);
 }
 });
 return taskEl;
}

function openDetailsView(task) {
 detailsTitle.textContent = task.content;
 const formattedDueDate = task.dueDate ? new Date(task.dueDate).toLocaleString() : "Not set.";
 const checklistHTML = task.checklist && task.checklist.length > 0
 ? `<div class="detail-item">
 <h3>Checklist</h3>
 <div id="details-checklist-container">
 ${task.checklist.map(item => `
 <div class="checklist-item">
 <input type="checkbox" id="details-check-${item.id}" ${item.completed ? 'checked' : ''} disabled>
 <label for="details-check-${item.id}">${item.text}</label>
 </div>
 `).join('')}
 </div>
 </div>`
 : '';

 detailsBody.innerHTML = `
 <div class="detail-item">
 <h3>Description</h3>
 <p>${task.description || "No description provided."}</p>
 </div>
 ${checklistHTML}
 <div class="detail-item">
 <h3>Due Date & Time</h3>
 <p>${formattedDueDate}</p>
 </div>
 <div class="detail-item priority-${task.priority}">
 <h3>Priority</h3>
 <p><span class="priority-badge ${task.priority}">${task.priority}</span></p>
 </div>
 `;
 editTaskBtn.dataset.taskId = task.id;
 detailsModal.style.display = "block";
 overlay.style.display = "block";
}

function openFormModal(task = null) {
 form.reset();
 document.querySelector("#priority-medium").checked = true;
 const checklistContainer = document.getElementById('checklist-items-list');
 checklistContainer.innerHTML = '';
 
 if (task) {
 formModalTitle.textContent = "Edit Task";
 document.getElementById("task-id").value = task.id;
 document.getElementById("task-title").value = task.content;
 document.getElementById("task-description").value = task.description;
 document.getElementById("task-due-date").value = task.dueDate;
 document.querySelector(`#priority-${task.priority}`).checked = true;
 renderChecklistInForm(task.checklist || []);
 } else {
 formModalTitle.textContent = "Add New Task";
 }
 formModal.style.display = "block";
 overlay.style.display = "block";
}

function renderChecklistInForm(checklist) {
 const listEl = document.getElementById('checklist-items-list');
 listEl.innerHTML = '';
 checklist.forEach(item => {
 const itemEl = document.createElement('div');
 itemEl.className = 'checklist-item';
 itemEl.dataset.itemId = item.id;
 itemEl.innerHTML = `
 <input type="checkbox" id="form-check-${item.id}" ${item.completed ? 'checked' : ''}>
 <label for="form-check-${item.id}">${item.text}</label>
 <button type="button" class="checklist-item-delete-btn"><i class="fas fa-times"></i></button>
 `;
 listEl.appendChild(itemEl);
 });
}

function closeModal() {
 detailsModal.style.display = "none";
 formModal.style.display = "none";
 dashboardModal.style.display = "none";
 overlay.style.display = "none";
}

function getDragAfterElement(container, xOrY, selector) {
 const draggableElements = [...container.querySelectorAll(`${selector}:not(.dragging)`)];
 return draggableElements.reduce((closest, child) => {
 const box = child.getBoundingClientRect();
 const offset = (container === board ? xOrY - box.left - box.width / 2 : xOrY - box.top - box.height / 2);
 if (offset < 0 && offset > closest.offset) {
 return { offset: offset, element: child };
 } else {
 return closest;
 }
 }, { offset: Number.NEGATIVE_INFINITY }).element;
}

function calculateAndShowStats() {
 const data = read();
 const allTasks = data.flatMap(col => col.tasks);
 const totalTasks = allTasks.length;
 const doneColumnTitle = "Done"; // Assuming last column is "Done"
 const doneColumn = data.find(col => col.title === doneColumnTitle);
 const completedTasks = doneColumn ? doneColumn.tasks.length : 0;
 const overdueTasks = allTasks.filter(task => task.dueDate && new Date(task.dueDate) < new Date()).length;
 
 document.getElementById('stat-total-tasks').textContent = totalTasks;
 document.getElementById('stat-completed-tasks').textContent = completedTasks;
 document.getElementById('stat-overdue-tasks').textContent = overdueTasks;

 const priorityCounts = allTasks.reduce((acc, task) => {
 acc[task.priority] = (acc[task.priority] || 0) + 1;
 return acc;
 }, {});

 const chartContainer = document.getElementById('priority-chart-container');
 chartContainer.innerHTML = '';
 ['high', 'medium', 'low'].forEach(priority => {
 const count = priorityCounts[priority] || 0;
 const percentage = totalTasks > 0 ? (count / totalTasks) * 100 : 0;
 const barEl = document.createElement('div');
 barEl.className = 'priority-chart-bar';
 barEl.innerHTML = `
 <div class="priority-chart-label">${priority}</div>
 <div class="priority-chart-fill-container">
 <div class="priority-chart-fill ${priority}" style="width: ${percentage}%">${count}</div>
 </div>
 `;
 chartContainer.appendChild(barEl);
 });
}

// --- EVENT LISTENERS ---
document.addEventListener("DOMContentLoaded", () => {
 // Load saved theme
 if (localStorage.getItem("theme") === "dark-mode") {
 document.body.classList.add("dark-mode");
 document.getElementById("theme-toggle").checked = true;
 }
 renderBoard();
});

board.addEventListener("click", e => {
 // Add task
 const addBtn = e.target.closest(".add-task-btn");
 if (addBtn) {
 openFormModal();
 form.dataset.columnId = addBtn.closest('.kanban-column').dataset.columnId;
 return;
 }

 // Delete task
 const deleteBtn = e.target.closest(".task-delete-btn");
 if (deleteBtn) {
 e.stopPropagation();
 const taskCard = deleteBtn.closest(".task-card");
 if (confirm("Are you sure you want to delete this task?")) {
 KanbanAPI.deleteTask(taskCard.dataset.taskId);
 renderBoard();
 }
 return;
 }
 
 // Rename column
 const columnTitle = e.target.closest(".column-title");
 if (columnTitle && !columnTitle.isContentEditable) {
 columnTitle.contentEditable = true;
 columnTitle.focus();
 columnTitle.addEventListener('blur', () => {
 columnTitle.contentEditable = false;
 const columnId = columnTitle.closest('.kanban-column').dataset.columnId;
 KanbanAPI.renameColumn(columnId, columnTitle.textContent);
 }, { once: true });
 columnTitle.addEventListener('keydown', (ev) => {
 if (ev.key === 'Enter') {
 columnTitle.blur();
 }
 });
 }

 // Delete Column
 const deleteColumnBtn = e.target.closest(".delete-column-btn");
 if(deleteColumnBtn) {
 const columnEl = deleteColumnBtn.closest('.kanban-column');
 if(confirm("Are you sure you want to delete this entire column?")) {
 KanbanAPI.deleteColumn(columnEl.dataset.columnId);
 renderBoard();
 }
 }
});

editTaskBtn.addEventListener("click", () => {
 const taskId = editTaskBtn.dataset.taskId;
 const task = read().flatMap(col => col.tasks).find(t => t.id == taskId);
 closeModal();
 setTimeout(() => openFormModal(task), 50);
});

form.addEventListener("submit", e => {
 e.preventDefault();
 const taskId = document.getElementById("task-id").value;
 const checklistItems = [];
 document.querySelectorAll('#checklist-items-list .checklist-item').forEach(itemEl => {
 checklistItems.push({
 id: Number(itemEl.dataset.itemId),
 text: itemEl.querySelector('label').textContent,
 completed: itemEl.querySelector('input[type="checkbox"]').checked
 });
 });

 const props = {
 content: document.getElementById("task-title").value,
 description: document.getElementById("task-description").value,
 dueDate: document.getElementById("task-due-date").value,
 priority: document.querySelector('input[name="priority"]:checked').value,
 checklist: checklistItems
 };

 if (taskId) {
 KanbanAPI.updateTask(taskId, props);
 } else {
 KanbanAPI.insertTask(form.dataset.columnId, props);
 }
 renderBoard();
 closeModal();
});

overlay.addEventListener("click", closeModal);
document.querySelectorAll(".close-modal-btn").forEach(btn => btn.addEventListener("click", closeModal));

document.getElementById("add-column-btn").addEventListener("click", () => {
 const title = prompt("Enter new column title:");
 if (title) {
 KanbanAPI.addColumn(title);
 renderBoard();
 }
});

// Checklist management in form
document.getElementById('add-checklist-item-btn').addEventListener('click', () => {
 const input = document.getElementById('new-checklist-item-input');
 if (input.value.trim()) {
 const listEl = document.getElementById('checklist-items-list');
 const itemEl = document.createElement('div');
 const newItem = { id: Date.now(), text: input.value.trim(), completed: false };
 itemEl.className = 'checklist-item';
 itemEl.dataset.itemId = newItem.id;
 itemEl.innerHTML = `
 <input type="checkbox" id="form-check-${newItem.id}">
 <label for="form-check-${newItem.id}">${newItem.text}</label>
 <button type="button" class="checklist-item-delete-btn"><i class="fas fa-times"></i></button>
 `;
 listEl.appendChild(itemEl);
 input.value = '';
 }
});

document.getElementById('checklist-items-list').addEventListener('click', e => {
 if (e.target.closest('.checklist-item-delete-btn')) {
 e.target.closest('.checklist-item').remove();
 }
});


// Data Management & Dashboard
document.getElementById('export-btn').addEventListener('click', () => {
 const data = JSON.stringify(read(), null, 2);
 const blob = new Blob([data], { type: 'application/json' });
 const url = URL.createObjectURL(blob);
 const a = document.createElement('a');
 a.href = url;
 a.download = 'tracker-board-data.json';
 a.click();
 URL.revokeObjectURL(url);
});

document.getElementById('import-btn').addEventListener('click', () => {
 document.getElementById('import-file').click();
});

document.getElementById('import-file').addEventListener('change', e => {
 const file = e.target.files[0];
 if (file) {
 const reader = new FileReader();
 reader.onload = (event) => {
 try {
 const data = JSON.parse(event.target.result);
 // Basic validation
 if (Array.isArray(data) && data.every(col => 'id' in col && 'title' in col && 'tasks' in col)) {
 save(data);
 renderBoard();
 } else {
 alert('Invalid file format.');
 }
 } catch (error) {
 alert('Error reading or parsing file.');
 }
 };
 reader.readAsText(file);
 }
});

document.getElementById('dashboard-btn').addEventListener('click', () => {
 calculateAndShowStats();
 dashboardModal.style.display = 'block';
 overlay.style.display = 'block';
});

// Theme Toggle
document.getElementById("theme-toggle").addEventListener("change", () => {
 document.body.classList.toggle("dark-mode");
 localStorage.setItem("theme", document.body.classList.contains("dark-mode") ? "dark-mode" : "light-mode");
});
// Search
document.getElementById("search-input").addEventListener("input", (e) => {
 const searchTerm = e.target.value.toLowerCase();
 document.querySelectorAll(".task-card").forEach(taskCard => {
 taskCard.style.display = taskCard.dataset.content.includes(searchTerm) ? "" : "none";
 });
});
// Keyboard Shortcuts
window.addEventListener("keydown", (e) => {
 if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA' || document.activeElement.isContentEditable) return;
 if (e.key.toLowerCase() === 'n') {
 e.preventDefault();
 openFormModal();
 form.dataset.columnId = read()[0].id;
 }
 if (e.key.toLowerCase() === 'f') {
 e.preventDefault();
 searchInput.focus();
 }
 if (e.key === 'Escape') {
 closeModal();
 }
});