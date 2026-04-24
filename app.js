const SUPABASE_URL = 'https://bfimdhcftfihmhpxktnl.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_7PRnxaF2pgkOxmOeMpDdLQ_H8j-DSul';
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
let currentUser = null;
let currentReviewId = null;
let currentEditId = null;
function escapeHTML(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
async function hashPassword(password) {
  if (!password) return '';
  const msgBuffer = new TextEncoder().encode(password + "Yagouo_Salt_2026"); 
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
const FIELD_MAP = {
  reportDate: 'report_date',
  medicalDate: 'medical_date',
  militaryDate: 'military_date',
  paymentDate: 'payment_date',
  booksDate: 'books_date',
  dormDate: 'dorm_date'
};
const ALL_PART_FIELDS = Object.keys(FIELD_MAP);
const db = {
  async getUserByUsername(username) {
    const { data, error } = await supabaseClient
      .from('system_users')
      .select('*')
      .eq('username', username)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  async verifyUserLogin(loginId) {
    const { data, error } = await supabaseClient
      .from('system_users')
      .select('*')
      .or(`username.eq.${loginId},student_id.eq.${loginId}`)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  async createUser(payload) {
    if (payload.user_type === 'admin' || payload.user_type === 'college') {
      if (!currentUser || currentUser.userType !== 'admin') {
        throw new Error('安全警告');
      }
    }
    const { data, error } = await supabaseClient
      .from('system_users')
      .insert(payload)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async updateUserPassword(username, newPassword) {
    const { error } = await supabaseClient
      .from('system_users')
      .update({ password: newPassword })
      .eq('username', username);
    if (error) throw error;
  },

  async updateUserProfile(username, payload) {
    if (!currentUser || currentUser.username !== username) {
      throw new Error('安全警告');
    }
    const { error } = await supabaseClient
      .from('system_users')
      .update(payload)
      .eq('username', username);
    if (error) throw error;
  },

  async findStudentInfoByStudentId(studentId) {
    if (!studentId) return null;
    const { data, error } = await supabaseClient
      .from('student_info')
      .select('*')
      .eq('student_id', studentId)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  async createStudentInfo(payload) {
    const { data, error } = await supabaseClient
      .from('student_info')
      .insert(payload)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async updateStudentInfo(id, payload) {
    if (payload.status && payload.status !== 'pending') {
      if (!currentUser || (currentUser.userType !== 'admin' && currentUser.userType !== 'college')) {
        throw new Error('安全警告');
      }
    }
    const { data, error } = await supabaseClient
      .from('student_info')
      .update(payload)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async getStudentInfoById(id) {
    const { data, error } = await supabaseClient
      .from('student_info')
      .select('*')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  },

  async deleteStudentInfo(id) {
    if (!currentUser || currentUser.userType !== 'admin') {
      throw new Error('安全警告');
    }
    const { error } = await supabaseClient.from('student_info').delete().eq('id', id);
    if (error) throw error;
  },

  async listStudentInfo({ searchText = '', page = 1, pageSize = 10 } = {}) {
    let query = supabaseClient
      .from('student_info')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false });

    if (searchText) {
      const safeSearchText = searchText.replace(/[%_]/g, '');
      query = query.or(
        `name.ilike.%${safeSearchText}%,id_card.ilike.%${safeSearchText}%,student_id.ilike.%${safeSearchText}%,college.ilike.%${safeSearchText}%,major.ilike.%${safeSearchText}%`
      );
    }

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    query = query.range(from, to);

    const { data, count, error } = await query;
    if (error) throw error;
    return { data: data || [], count: count || 0 };
  }
};
async function checkSupabaseConnection() {
  const { error } = await supabaseClient.from('system_users').select('id').limit(1);
  if (error) throw new Error(`Supabase连接失败：${error.message}`);
  console.log('Supabase 连接成功，系统防御矩阵已启动。');
}

async function initializeApp() {
  try {
    await checkSupabaseConnection();
    setupEventListeners();

    const savedUserJSON = localStorage.getItem('currentUser');
    if (savedUserJSON) {
      currentUser = JSON.parse(savedUserJSON);
      
      if (currentUser && !currentUser.userType && currentUser.user_type) {
        currentUser.userType = currentUser.user_type;
      }
      if (currentUser) {
        if (!currentUser.realName && currentUser.real_name) currentUser.realName = currentUser.real_name;
        if (!currentUser.studentId && currentUser.student_id) currentUser.studentId = currentUser.student_id;
        if (!currentUser.idCard && currentUser.id_card) currentUser.idCard = currentUser.id_card;
        localStorage.setItem('currentUser', JSON.stringify(currentUser)); 
      }

      if (currentUser && currentUser.username) {
        document.getElementById('loginPage').style.display = 'none';
        document.getElementById('mainPage').style.display = 'block';
        setupUserInterface();
      }
    }
    console.log('应用初始化完成');
  } catch (error) {
    console.error('应用初始化失败:', error);
    showNotification(`系统初始化失败: ${error.message}`, 'error');
  }
}
function setupEventListeners() {
  document.getElementById('loginForm')?.addEventListener('submit', (e) => { e.preventDefault(); login(); });
  document.getElementById('showRegisterModal')?.addEventListener('click', showRegisterModal);
  document.getElementById('modalRegisterBtn')?.addEventListener('click', registerStudent);
  document.getElementById('changePasswordLink')?.addEventListener('click', showChangePasswordModal);
  document.getElementById('logoutBtn')?.addEventListener('click', logout);
  
  document.getElementById('studentInfoForm')?.addEventListener('submit', (e) => { e.preventDefault(); submitStudentInfo(); });
  document.getElementById('personalInfoUpdateForm')?.addEventListener('submit', (e) => { e.preventDefault(); savePersonalInfo(); });

  document.getElementById('queryFormInner')?.addEventListener('submit', (e) => { e.preventDefault(); queryStudentInfo(); });
  document.getElementById('adminCreateAccountForm')?.addEventListener('submit', (e) => { e.preventDefault(); adminCreateAccount(); });
  document.getElementById('modalPasswordForm')?.addEventListener('submit', (e) => { e.preventDefault(); changePasswordModal(); });
  document.getElementById('editForm')?.addEventListener('submit', (e) => { e.preventDefault(); saveEdit(); });

  document.getElementById('adminCreateBtn')?.addEventListener('click', adminCreateAccount);
  document.querySelectorAll('input[name="adminCreateAccountType"]').forEach(radio => {
    radio.addEventListener('change', function () {
      const section = document.getElementById('adminCreateCollegeSection');
      if (section) section.style.display = this.value === 'college' ? 'block' : 'none';
    });
  });

  document.getElementById('queryBtn')?.addEventListener('click', queryStudentInfo);
  document.getElementById('exportCollegeData')?.addEventListener('click', exportCollegeData);
  document.getElementById('searchBtn')?.addEventListener('click', () => loadStudentInfos());
  document.getElementById('exportBtn')?.addEventListener('click', exportData);
  document.getElementById('refreshBtn')?.addEventListener('click', () => loadStudentInfos());

  document.getElementById('adminSearchBtn')?.addEventListener('click', () => loadAdminStudentInfos());
  document.getElementById('adminExportBtn')?.addEventListener('click', exportAllData);
  document.getElementById('adminQueryBtn')?.addEventListener('click', adminAdvancedQuery);

  document.getElementById('approveBtn')?.addEventListener('click', () => reviewStudentInfo(true));
  document.getElementById('rejectBtn')?.addEventListener('click', () => reviewStudentInfo(false));
  document.getElementById('saveEditBtn')?.addEventListener('click', saveEdit);
  document.getElementById('modalChangePasswordBtn')?.addEventListener('click', changePasswordModal);

  document.getElementById('searchInput')?.addEventListener('keypress', (e) => { if (e.key === 'Enter') loadStudentInfos(); });
  document.getElementById('adminSearchInput')?.addEventListener('keypress', (e) => { if (e.key === 'Enter') loadAdminStudentInfos(); });

  document.getElementById('modalNewPassword')?.addEventListener('input', checkPasswordStrengthHandler);
  document.getElementById('modalRegisterPassword')?.addEventListener('input', checkRegisterPasswordStrengthHandler);
}
async function login() {
  const loginId = document.getElementById('loginStudentId')?.value.trim();
  const password = document.getElementById('password')?.value;

  if (!loginId || !password) {
    showNotification('请输入学号(或账号)和密码', 'error');
    return;
  }

  const loginBtn = document.getElementById('loginBtn');
  setButtonLoading(loginBtn, true, '登录');

  try {
    const user = await db.verifyUserLogin(loginId);
    
    if (!user) {
      showNotification('学号/账号或密码错误', 'error');
      return;
    }

    const hashedPassword = await hashPassword(password);
    let loginSuccess = false;

    if (user.password === hashedPassword) {
      loginSuccess = true;
    } else if (user.password === password && !isHashedFormat(user.password)) {
      await db.updateUserPassword(user.username, hashedPassword);
      console.log('✅ 检测到旧明文密码，已自动升级为安全哈希');
      loginSuccess = true;
    }

    if (loginSuccess) {
      const safeUserToSave = { ...user };
      delete safeUserToSave.password;
      
      safeUserToSave.userType = safeUserToSave.user_type;
      safeUserToSave.realName = safeUserToSave.real_name;
      safeUserToSave.studentId = safeUserToSave.student_id;
      safeUserToSave.idCard = safeUserToSave.id_card;

      currentUser = safeUserToSave;
      localStorage.setItem('currentUser', JSON.stringify(safeUserToSave));

      document.getElementById('loginPage').style.display = 'none';
      document.getElementById('mainPage').style.display = 'block';

      setupUserInterface();
      showNotification('登录成功！', 'success');
    } else {
      showNotification('学号/账号或密码错误', 'error');
    }
  } catch (error) {
    console.error('登录失败:', error);
    showNotification('登录失败，请检查网络连接后重试', 'error');
  } finally {
    setButtonLoading(loginBtn, false, '登录');
  }
}

function isHashedFormat(str) {
  return str && str.length === 64 && /^[0-9a-f]{64}$/i.test(str);
}

function setupUserInterface() {
  document.querySelectorAll('.nav-item').forEach(tab => tab.classList.add('hidden-tab'));
  document.querySelectorAll('.tab-pane').forEach(pane => pane.classList.remove('show', 'active'));
  document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('active'));

  let roleText = '';
  let headerClass = '';
  let defaultTabId = '';

  switch (currentUser.userType) {
    case 'admin':
      roleText = '学工处超级管理员';
      headerClass = 'admin-header';
      setupAdminInterface();
      defaultTabId = 'overviewTab';
      break;
    case 'college':
      roleText = escapeHTML(currentUser.college) || '学院管理员';
      headerClass = 'college-header';
      setupCollegeInterface();
      defaultTabId = 'collegeDataTab';
      break;
    default:
      roleText = '学生';
      headerClass = 'student-header';
      setupStudentInterface();
      defaultTabId = 'personalInfoTab';
      break;
  }

  if (defaultTabId) {
    const tabLink = document.getElementById(defaultTabId);
    const pane = document.getElementById(defaultTabId.replace('Tab', ''));
    if (tabLink) tabLink.classList.add('active');
    if (pane) pane.classList.add('show', 'active');
  }

  const mainHeader = document.getElementById('mainHeader');
  if (mainHeader) mainHeader.className = `header ${headerClass}`;

  const roleBadge = document.getElementById('roleBadge');
  if (roleBadge) roleBadge.textContent = roleText;

  const welcomeSpan = document.querySelector('#welcomeMessage #currentUserName');
  if (welcomeSpan) welcomeSpan.textContent = currentUser.realName || currentUser.real_name || currentUser.username;
}

function setupAdminInterface() {
  ['overviewTabItem', 'dataManagementTabItem', 'searchTabItem', 'createAdminTabItem', 'manageTabItem', 'queryTabItem']
    .forEach(id => document.getElementById(id)?.classList.remove('hidden-tab'));

  setTimeout(() => {
    loadAdminOverview();
    loadAdminStudentInfos();
    loadStudentInfos();
  }, 100);
}

function setupCollegeInterface() {
  ['collegeDataTabItem', 'reviewTabItem']
    .forEach(id => document.getElementById(id)?.classList.remove('hidden-tab'));

  setTimeout(() => {
    loadCollegeData();
    loadReviewData();
  }, 100);
}

function setupStudentInterface() {
  ['personalInfoTabItem', 'infoTabItem']
    .forEach(id => document.getElementById(id)?.classList.remove('hidden-tab'));

  setupStudentForm();

  setTimeout(() => {
    loadStudentPersonalInfo();
    checkStudentSubmission();
  }, 100);
}

function logout() {
  localStorage.removeItem('currentUser');
  currentUser = null;
  
  const tablesToClear = ['adminDataTableBody', 'collegeTableBody', 'reviewTableBody', 'dataTableBody', 'adminQueryTableBody'];
  tablesToClear.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = ''; 
  });
  document.querySelectorAll('.stats-number').forEach(el => el.textContent = '0');
  document.querySelectorAll('form').forEach(form => form.reset());

  document.getElementById('mainPage').style.display = 'none';
  document.getElementById('loginPage').style.display = 'block';
  
  showNotification('已安全退出，各项页面数据和状态已隔离重置。', 'success');
}
function showRegisterModal() {
  document.getElementById('registerForm')?.reset();
  document.querySelectorAll('.error-message').forEach(el => (el.textContent = ''));

  document.getElementById('studentFields') && (document.getElementById('studentFields').style.display = 'block');
  document.getElementById('adminPasswordSection') && (document.getElementById('adminPasswordSection').style.display = 'none');
  document.getElementById('collegeSection')?.classList.remove('hidden');

  document.querySelectorAll('input[name="accountType"]').forEach(radio => {
    const parentDiv = radio.closest('.form-check');
    if (radio.value !== 'student') {
      if (parentDiv) parentDiv.style.display = 'none';
    } else {
      radio.checked = true;
      if (parentDiv) parentDiv.style.display = 'block';
    }
  });

  new bootstrap.Modal(document.getElementById('registerModal')).show();
}

async function registerStudent() {
  const formData = {
    username: document.getElementById('modalRegisterUsername')?.value.trim() || '',
    password: document.getElementById('modalRegisterPassword')?.value || '',
    confirmPassword: document.getElementById('modalRegisterConfirmPassword')?.value || '',
    college: document.getElementById('modalRegisterCollege')?.value.trim() || '',
    realName: document.getElementById('modalRegisterRealName')?.value.trim() || '',
    phone: document.getElementById('modalRegisterPhone')?.value.trim() || '',
    grade: document.getElementById('modalRegisterGrade')?.value.trim() || '',
    major: document.getElementById('modalRegisterMajor')?.value.trim() || '',
    studentId: document.getElementById('modalRegisterStudentId')?.value.trim() || '',
    idCard: document.getElementById('modalRegisterIdCard')?.value.trim() || '',
    accountType: 'student'
  };

  const errors = await validateAccountForm(formData);
  if (errors.length > 0) {
    showFormErrors('modalRegister', errors);
    return;
  }

  await executeRegistration(formData, 'modalRegisterBtn', '注册');
}

async function adminCreateAccount() {
  const accountType = document.querySelector('input[name="adminCreateAccountType"]:checked')?.value;
  if (!accountType) {
    showNotification('请选择创建的管理员类型', 'error');
    return;
  }

  const formData = {
    username: document.getElementById('adminCreateUsername')?.value.trim() || '',
    password: document.getElementById('adminCreatePassword')?.value || '',
    confirmPassword: document.getElementById('adminCreateConfirmPassword')?.value || '',
    realName: document.getElementById('adminCreateRealName')?.value.trim() || '',
    college: document.getElementById('adminCreateCollege')?.value.trim() || '',
    accountType
  };

  const errors = await validateAccountForm(formData);
  if (errors.length > 0) {
    showNotification(errors.map(e => e.message).join('；\n'), 'error');
    return;
  }

  const success = await executeRegistration(formData, 'adminCreateBtn', '创建管理员');
  if (success) document.getElementById('adminCreateAccountForm')?.reset();
}

async function executeRegistration(formData, buttonId, buttonText) {
  const registerBtn = document.getElementById(buttonId);
  setButtonLoading(registerBtn, true, buttonText);
  let success = false;

  try {
    const hashedPassword = await hashPassword(formData.password);

    const payload = {
      username: formData.username,
      password: hashedPassword, 
      user_type: formData.accountType,
      real_name: formData.realName,
      college: formData.accountType === 'admin' ? '学工处' : (formData.college || null),
      phone: formData.phone || null,
      grade: formData.grade || null,
      major: formData.major || null,
      student_id: formData.studentId || null,
      id_card: formData.idCard || null
    };

    await db.createUser(payload);
    showNotification(formData.accountType === 'student' ? '账号注册成功！' : '管理员账号创建成功！', 'success');
    success = true;

    if (formData.accountType === 'student') {
      const modal = bootstrap.Modal.getInstance(document.getElementById('registerModal'));
      modal?.hide();
    }
  } catch (error) {
    console.error('操作失败:', error);
    showNotification(`操作失败: ${error.message}`, 'error');
  } finally {
    setButtonLoading(registerBtn, false, buttonText);
  }

  return success;
}

async function validateAccountForm(formData) {
  const errors = [];

  if (!formData.username) errors.push({ field: 'Username', message: '请输入用户名' });
  else {
    const existingUser = await db.getUserByUsername(formData.username);
    if (existingUser) errors.push({ field: 'Username', message: '用户名已存在' });
  }

  const password = formData.password || '';
  const strongRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
  
  if (!password) {
    errors.push({ field: 'Password', message: '请输入密码' });
  } else if (!strongRegex.test(password)) {
    errors.push({ field: 'Password', message: '密码必须包含大小写字母、数字及特殊字符，且不少于8位' });
  }

  if (password !== formData.confirmPassword) errors.push({ field: 'ConfirmPassword', message: '两次输入的密码不一致' });
  if (!formData.realName) errors.push({ field: 'RealName', message: '请输入姓名' });

  if (formData.accountType === 'student') {
    if (!formData.idCard) errors.push({ field: 'IdCard', message: '请输入身份证号' });

    if (!formData.studentId) errors.push({ field: 'StudentId', message: '请输入学号' });
    else {
      const { data } = await supabaseClient
        .from('system_users')
        .select('id')
        .eq('student_id', formData.studentId)
        .maybeSingle();
      if (data) errors.push({ field: 'StudentId', message: '该学号已被注册' });
    }

    if (!formData.college) errors.push({ field: 'College', message: '请选择学院' });
    if (!formData.grade) errors.push({ field: 'Grade', message: '请输入年级' });
    if (!formData.major) errors.push({ field: 'Major', message: '请输入专业' });
  }

  if (formData.accountType === 'college' && !formData.college) {
    errors.push({ field: 'College', message: '请为该学院管理员指定负责的学院' });
  }

  return errors;
}

function showFormErrors(formPrefix, errors) {
  document.querySelectorAll('.error-message').forEach(el => (el.textContent = ''));
  errors.forEach(error => {
    const errorElement =
      document.getElementById(`${formPrefix}${error.field}Error`) ||
      document.getElementById(`modalRegister${error.field}Error`);
    if (errorElement) errorElement.textContent = error.message;
  });
}
function showChangePasswordModal(e) {
  e.preventDefault();
  if (currentUser) {
    const unameInput = document.getElementById('modalUsername');
    if (unameInput) {
      unameInput.value = currentUser.username;
      unameInput.style.display = 'none'; 
    }
  }
  new bootstrap.Modal(document.getElementById('changePasswordModal')).show();
}

function getPasswordFormData() {
  return {
    username: currentUser ? currentUser.username : (document.getElementById('modalUsername')?.value.trim() || ''),
    currentPassword: document.getElementById('modalCurrentPassword')?.value || '',
    newPassword: document.getElementById('modalNewPassword')?.value || '',
    confirmPassword: document.getElementById('modalConfirmPassword')?.value || ''
  };
}

function validatePasswordForm(formData) {
  const errors = [];
  if (!formData.username) errors.push('请输入用户名');
  if (!formData.currentPassword) errors.push('请输入当前密码');
  
  const strongRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
  if (!formData.newPassword) {
    errors.push('请输入新密码');
  } else if (!strongRegex.test(formData.newPassword)) {
    errors.push('新密码必须包含大小写字母、数字及特殊字符，且不少于8位');
  }
  
  if (!formData.confirmPassword) errors.push('请确认新密码');
  else if (formData.newPassword !== formData.confirmPassword) errors.push('新密码和确认密码不匹配');
  return errors;
}

function showPasswordFormErrors(errors) {
  const errorElement = document.getElementById('modalPasswordError');
  if (errorElement) {
    errorElement.textContent = errors.join('；');
    errorElement.style.display = 'block';
    setTimeout(() => { errorElement.style.display = 'none'; }, 5000);
  }
}

async function changePasswordModal() {
  const formData = getPasswordFormData();
  const errors = validatePasswordForm(formData);
  if (errors.length > 0) {
    showPasswordFormErrors(errors);
    return;
  }

  const changeBtn = document.getElementById('modalChangePasswordBtn');
  setButtonLoading(changeBtn, true, '修改密码');

  try {
    const user = await db.getUserByUsername(formData.username);
    if (!user) throw new Error('用户名不存在');

    const hashedCurrent = await hashPassword(formData.currentPassword);
    const hashedNew = await hashPassword(formData.newPassword);

    if (user.password !== hashedCurrent) throw new Error('当前密码错误');

    await db.updateUserPassword(formData.username, hashedNew);
    
    if (currentUser && currentUser.username === formData.username) {
        showNotification('密码修改成功，请谨记新密码！', 'success');
    }

    document.getElementById('modalPasswordForm')?.reset();

    setTimeout(() => {
      const modal = bootstrap.Modal.getInstance(document.getElementById('changePasswordModal'));
      if (modal) modal.hide();
    }, 800);
  } catch (error) {
    console.error('修改密码失败:', error);
    showNotification(`修改密码失败: ${error.message}`, 'error');
  } finally {
    setButtonLoading(changeBtn, false, '修改密码');
  }
}
function checkPasswordStrengthHandler() {
  const password = this.value;
  checkPasswordStrength(password, 'modalPasswordStrength', 'modalLengthReq', 'modalUppercaseReq', 'modalLowercaseReq', 'modalNumberReq', 'modalSpecialReq');
}
function checkRegisterPasswordStrengthHandler() {
  const password = this.value;
  checkPasswordStrength(password, 'modalRegisterPasswordStrength', 'modalRegisterLengthReq', 'modalRegisterUppercaseReq', 'modalRegisterLowercaseReq', 'modalRegisterNumberReq', 'modalRegisterSpecialReq');
}
function checkPasswordStrength(password, strengthBarId, ...requirementIds) {
  const requirements = [
    { test: p => p.length >= 8, id: requirementIds[0] },
    { test: p => /[A-Z]/.test(p), id: requirementIds[1] },
    { test: p => /[a-z]/.test(p), id: requirementIds[2] },
    { test: p => /[0-9]/.test(p), id: requirementIds[3] },
    { test: p => /[^A-Za-z0-9]/.test(p), id: requirementIds[4] }
  ];

  let strength = 0;
  requirements.forEach(req => {
    const element = document.getElementById(req.id);
    if (!element) return;
    if (req.test(password)) {
      strength++;
      element.className = 'valid';
    } else {
      element.className = 'invalid';
    }
  });

  const bar = document.getElementById(strengthBarId);
  if (!bar) return;

  if (strength <= 2) bar.className = 'password-strength strength-weak';
  else if (strength <= 4) bar.className = 'password-strength strength-medium';
  else bar.className = 'password-strength strength-strong';
}
function setButtonLoading(button, loading, text = '') {
  if (!button) return;
  if (loading) {
    button.disabled = true;
    button.innerHTML = '<span class="loading-spinner"></span> 处理中...';
  } else {
    button.disabled = false;
    button.innerHTML = text; 
  }
}

function showNotification(message, type = 'info') {
  const types = {
    success: { class: 'alert alert-success', icon: 'fa-check' },
    error: { class: 'alert alert-danger', icon: 'fa-exclamation-triangle' },
    warning: { class: 'alert alert-warning', icon: 'fa-exclamation-circle' },
    info: { class: 'alert alert-info', icon: 'fa-info-circle' }
  };
  const cfg = types[type] || types.info;

  const notification = document.createElement('div');
  notification.className = `${cfg.class} alert-dismissible fade show position-fixed`;
  notification.style.cssText = 'top:20px;right:20px;z-index:9999;min-width:300px;';
  notification.innerHTML = `
    <i class="fas ${cfg.icon} me-2"></i><span>${escapeHTML(message)}</span>
    <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
  `;
  document.body.appendChild(notification);
  setTimeout(() => notification.remove(), 5000);
}

function formatDateForInput(date) {
  if (!date) return '';
  const d = new Date(date);
  return d.toISOString().split('T')[0];
}
function formatDate(date) {
  if (!date) return '';
  return new Date(date).toLocaleDateString('zh-CN');
}
function renderStatusBadge(status) {
  const statusConfig = {
    pending: { text: '待审核', class: 'status-pending' },
    approved: { text: '已通过', class: 'status-approved' },
    rejected: { text: '未通过', class: 'status-rejected' },
    partially_approved: { text: '部分通过', class: 'status-partial' }
  };
  const config = statusConfig[status] || statusConfig.pending;
  return `<span class="status-badge ${config.class}">${escapeHTML(config.text)}</span>`;
}
function showEmptyState(containerId, message, colspan = 10) {
  const container = document.getElementById(containerId);
  if (container) {
    container.innerHTML = `<tr><td colspan="${colspan}" class="text-center text-muted py-4">${escapeHTML(message)}</td></tr>`;
  }
}
function downloadCSV(csvContent, filename) {
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.href = url;
  link.download = filename;
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 100);
}
function statusText(status) {
  if (status === 'approved') return '已通过';
  if (status === 'rejected') return '未通过';
  if (status === 'partially_approved') return '部分通过';
  return '待审核';
}

function getFieldDisplayName(field) {
  const fieldNames = {
    reportDate: '入学报到时间',
    medicalDate: '体检完成时间',
    militaryDate: '军训结业时间',
    paymentDate: '学费缴纳时间',
    booksDate: '教材领取时间',
    dormDate: '宿舍入住时间'
  };
  return fieldNames[field] || field;
}

function validateDates(formData) {
  const getD = (val) => {
    if (!val) return null;
    const d = new Date(val);
    d.setHours(0, 0, 0, 0);
    return d;
  };

  const reportDateInput = document.getElementById('reportDate');
  const reportDateVal = formData.reportDate || (reportDateInput ? reportDateInput.value : '');
  const reportDate = getD(reportDateVal);

  for (const [field, value] of Object.entries(formData)) {
    if (value) {
      const date = getD(value);
      
      if (reportDate && field !== 'reportDate') {
        if (['militaryDate', 'booksDate', 'dormDate'].includes(field)) {
          if (date < reportDate) {
            showNotification(`【填写错误】${getFieldDisplayName(field)}逻辑上不能早于入学报到时间`, 'error');
            return false;
          }
        }
      } else if (!reportDate && ['militaryDate', 'booksDate', 'dormDate'].includes(field)) {
        showNotification(`【填写错误】请先填写入学报到时间！${getFieldDisplayName(field)}不能早于报到时间`, 'error');
        return false;
      }
    }
  }
  return true;
}

function getStudentFormData() {
  return {
    reportDate: document.getElementById('reportDate')?.value || '',
    medicalDate: document.getElementById('medicalDate')?.value || '',
    militaryDate: document.getElementById('militaryDate')?.value || '',
    paymentDate: document.getElementById('paymentDate')?.value || '',
    booksDate: document.getElementById('booksDate')?.value || '',
    dormDate: document.getElementById('dormDate')?.value || ''
  };
}

function validateStudentForm(formData) {
  const hasData = Object.values(formData).some(value => value !== '');
  if (!hasData) {
    showNotification('请至少填写一个时间信息', 'error');
    return false;
  }
  return validateDates(formData);
}

function getSubmittedParts(formData) {
  return Object.keys(formData).filter(key => formData[key] !== '');
}

function clearFormFields() {
  ['reportDate', 'medicalDate', 'militaryDate', 'paymentDate', 'booksDate', 'dormDate'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
}

function disableApprovedFields(approvedParts) {
  ALL_PART_FIELDS.forEach(field => {
    const input = document.getElementById(field);
    if (!input) return;
    if (approvedParts.includes(field)) {
      input.disabled = true;
      input.title = '此项注册已通过审核，不可修改';
      input.classList.add('disabled-field');
    } else {
      input.disabled = false;
      input.title = '';
      input.classList.remove('disabled-field');
    }
  });
}

function setupStudentForm() {
  if (!currentUser) return;
  const realName = currentUser.realName || currentUser.real_name || '';
  const idCard = currentUser.idCard || currentUser.id_card || '';
  const studentId = currentUser.studentId || currentUser.student_id || '';

  const map = {
    nameReadonly: realName,
    idCardReadonly: idCard,
    collegeReadonly: currentUser.college || '',
    studentIdReadonly: studentId,
    gradeReadonly: currentUser.grade || '',
    majorReadonly: currentUser.major || ''
  };

  Object.entries(map).forEach(([id, value]) => {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  });

  const reportInput = document.getElementById('reportDate');
  const restrictFields = ['militaryDate', 'booksDate', 'dormDate'];
  
  restrictFields.forEach(field => {
    const input = document.getElementById(field);
    if (input) {
      input.addEventListener('change', (e) => {
        const currentVal = e.target.value;
        const reportVal = reportInput?.value;
        if (currentVal && reportVal) {
          if (new Date(currentVal) < new Date(reportVal)) {
            showNotification(`【时间逻辑错误】\n${getFieldDisplayName(field)}不能早于“入学报到时间”，请重新选择！`, 'warning');
            e.target.value = ''; 
          }
        } else if (currentVal && !reportVal) {
            showNotification(`💡 建议先填写“入学报到时间”。\n注意：${getFieldDisplayName(field)}等操作不可早于报到时间。`, 'info');
        }
      });
    }
  });
  
  if (reportInput) {
    reportInput.addEventListener('change', (e) => {
      const reportVal = e.target.value;
      if (!reportVal) return;
      restrictFields.forEach(field => {
        const input = document.getElementById(field);
        if (input && input.value) {
          if (new Date(input.value) < new Date(reportVal)) {
            showNotification(`【自动修正】\n${getFieldDisplayName(field)}早于最新修改的“入学报到时间”，已被系统自动清空，请重新填写！`, 'warning');
            input.value = '';
          }
        }
      });
    });
  }
}

async function createNewRecord(formData) {
  const payload = {
    name: currentUser.realName || currentUser.real_name || '',
    id_card: currentUser.idCard || currentUser.id_card || '',
    college: currentUser.college || '',
    student_id: currentUser.studentId || currentUser.student_id || '',
    grade: currentUser.grade || '',
    major: currentUser.major || '',
    status: 'pending',
    submitted_parts: getSubmittedParts(formData),
    approved_parts: [],
    created_by: currentUser.username
  };

  Object.entries(FIELD_MAP).forEach(([camel, snake]) => {
    payload[snake] = formData[camel] || null;
  });

  await db.createStudentInfo(payload);
}

async function updatePartialRecord(existingRow, formData, approvedParts) {
  const newParts = Object.keys(formData).filter(k => formData[k] && !approvedParts.includes(k));
  if (newParts.length === 0) throw new Error('您尝试提交的字段已通过审核，无法修改');

  const patch = {
    status: 'pending',
    submitted_parts: [...new Set([...(existingRow.submitted_parts || []), ...newParts])]
  };

  newParts.forEach(camel => {
    patch[FIELD_MAP[camel]] = formData[camel];
  });

  await db.updateStudentInfo(existingRow.id, patch);
}

async function handleSubmission(formData) {
  const studentId = currentUser.studentId || currentUser.student_id;
  const existing = await db.findStudentInfoByStudentId(studentId);

  if (!existing) {
    await createNewRecord(formData);
    return;
  }

  const status = existing.status || 'pending';
  const approvedParts = existing.approved_parts || [];

  if (status === 'approved') throw new Error('您的所有报到信息已通过审核，无需再次提交');
  if (status === 'pending') throw new Error('您有信息正在等待审核，请等待审核完成后再提交');

  await updatePartialRecord(existing, formData, approvedParts);
}

async function submitStudentInfo() {
  const formData = getStudentFormData();
  if (!validateStudentForm(formData)) return;

  const submitBtn = document.getElementById('submitBtn');
  setButtonLoading(submitBtn, true, '提交信息');

  try {
    await handleSubmission(formData);
    showNotification('信息提交成功！等待学院审核。', 'success');
    await checkStudentSubmission();
    await loadStudentPersonalInfo();
    clearFormFields();
  } catch (error) {
    console.error('提交失败:', error);
    showNotification(`提交失败: ${error.message}`, 'error');
  } finally {
    setButtonLoading(submitBtn, false, '提交信息');
  }
}

async function checkStudentSubmission() {
  const studentId = currentUser?.studentId || currentUser?.student_id;
  if (!studentId) return;

  try {
    const row = await db.findStudentInfoByStudentId(studentId);
    
    if (row) {
      const dbToFormMap = {
        report_date: 'reportDate',
        medical_date: 'medicalDate',
        military_date: 'militaryDate',
        payment_date: 'paymentDate',
        books_date: 'booksDate',
        dorm_date: 'dormDate'
      };

      Object.entries(dbToFormMap).forEach(([dbField, inputId]) => {
        const inputEl = document.getElementById(inputId);
        if (inputEl && row[dbField]) {
          inputEl.value = formatDateForInput(row[dbField]);
        }
      });
    }

    const warning = document.getElementById('duplicateWarning');
    const warningText = document.getElementById('warningText');
    const submitBtn = document.getElementById('submitBtn');

    if (!row) {
      if (warning) warning.style.display = 'none';
      if (submitBtn) submitBtn.disabled = false;
      disableApprovedFields([]);
      return;
    }

    const status = row.status || 'pending';
    const approvedParts = row.approved_parts || [];

    let message = '';
    let disableSubmit = false;

    if (status === 'approved') {
      message = '您的所有迎新注册信息已通过审核';
      disableSubmit = true;
    } else if (status === 'pending') {
      message = '您有信息正在等待审核';
      disableSubmit = true;
    } else if (status === 'rejected') {
      message = '您的最新提交未通过审核，请修改后重新提交';
      disableSubmit = false;
    } else if (status === 'partially_approved') {
      const remaining = ALL_PART_FIELDS.filter(f => !approvedParts.includes(f));
      const remainingNames = remaining.map(getFieldDisplayName).join('、');
      message = `部分信息已审核通过，可继续提交：${remainingNames}`;
      disableSubmit = false;
    }

    disableApprovedFields(approvedParts);

    if (warningText) warningText.textContent = message;
    if (warning) warning.style.display = 'block';
    if (submitBtn) submitBtn.disabled = disableSubmit;
  } catch (error) {
    console.error('检查提交状态失败:', error);
    const warning = document.getElementById('duplicateWarning');
    if (warning) warning.style.display = 'none';
    const submitBtn = document.getElementById('submitBtn');
    if (submitBtn) submitBtn.disabled = false;
  }
}

async function loadStudentPersonalInfo() {
  try {
    const studentId = currentUser.studentId || currentUser.student_id;
    if (!studentId) return;

    const row = await db.findStudentInfoByStudentId(studentId);

    document.getElementById('updPersonalName').value = currentUser.realName || currentUser.real_name || '';
    document.getElementById('updPersonalStudentId').value = studentId;
    document.getElementById('updPersonalIdCard').value = currentUser.idCard || currentUser.id_card || '';
    document.getElementById('updPersonalCollege').value = currentUser.college || '';
    document.getElementById('updPersonalMajor').value = currentUser.major || '';
    document.getElementById('updPersonalGrade').value = currentUser.grade || '';

    const setText = (id, value, def = '未填写') => {
      const el = document.getElementById(id);
      if (el) el.textContent = value || def; 
    };

    if (row) {
      setText('personalReportDate', formatDate(row.report_date));
      setText('personalMedicalDate', formatDate(row.medical_date));
      setText('personalMilitaryDate', formatDate(row.military_date));
      setText('personalPaymentDate', formatDate(row.payment_date));
      setText('personalBooksDate', formatDate(row.books_date));
      setText('personalDormDate', formatDate(row.dorm_date));

      const statusEl = document.getElementById('personalStatus');
      if (statusEl) statusEl.innerHTML = renderStatusBadge(row.status);
    } else {
      setText('personalReportDate', '');
      setText('personalMedicalDate', '');
      setText('personalMilitaryDate', '');
      setText('personalPaymentDate', '');
      setText('personalBooksDate', '');
      setText('personalDormDate', '');

      const statusEl = document.getElementById('personalStatus');
      if (statusEl) statusEl.innerHTML = renderStatusBadge('pending');
    }
  } catch (error) {
    console.error('加载个人信息失败:', error);
  }
}

async function savePersonalInfo() {
  const btn = document.getElementById('updatePersonalInfoBtn');
  setButtonLoading(btn, true, '保存中');

  try {
    const payload = {
      real_name: document.getElementById('updPersonalName').value.trim(),
      id_card: document.getElementById('updPersonalIdCard').value.trim(),
      college: document.getElementById('updPersonalCollege').value.trim(),
      major: document.getElementById('updPersonalMajor').value.trim(),
      grade: document.getElementById('updPersonalGrade').value.trim()
    };

    await db.updateUserProfile(currentUser.username, payload);

    currentUser.realName = payload.real_name;
    currentUser.real_name = payload.real_name;
    currentUser.idCard = payload.id_card;
    currentUser.id_card = payload.id_card;
    currentUser.college = payload.college;
    currentUser.major = payload.major;
    currentUser.grade = payload.grade;
    localStorage.setItem('currentUser', JSON.stringify(currentUser));
    
    const welcomeSpan = document.querySelector('#welcomeMessage #currentUserName');
    if (welcomeSpan) welcomeSpan.textContent = currentUser.realName || currentUser.username;

    const studentId = currentUser.studentId || currentUser.student_id;
    if (studentId) {
      const existingRow = await db.findStudentInfoByStudentId(studentId);
      if (existingRow) {
        await db.updateStudentInfo(existingRow.id, {
          name: payload.real_name,
          id_card: payload.id_card,
          college: payload.college,
          major: payload.major,
          grade: payload.grade
        });
      }
    }

    setupStudentForm();
    showNotification('个人信息修改成功！', 'success');

  } catch (error) {
    console.error('保存失败:', error);
    showNotification('保存失败: ' + error.message, 'error');
  } finally {
    setButtonLoading(btn, false, '保存修改');
  }
}

async function queryStudentInfo() {
  const name = document.getElementById('queryName')?.value.trim() || '';
  const idCard = document.getElementById('queryIdCard')?.value.trim() || '';

  if (!name && !idCard) {
    showNotification('请输入姓名或身份证号进行查询', 'error');
    return;
  }

  const queryBtn = document.getElementById('queryBtn');
  setButtonLoading(queryBtn, true, '查询信息');

  try {
    let query = supabaseClient.from('student_info').select('*').eq('status', 'approved');
    if (name) query = query.eq('name', name);
    if (idCard) query = query.eq('id_card', idCard);

    if (currentUser.userType === 'college') query = query.eq('college', currentUser.college);
    if (currentUser.userType === 'student') {
        const studentId = currentUser.studentId || currentUser.student_id;
        query = query.eq('student_id', studentId);
    }

    const { data, error } = await query.limit(1).maybeSingle();
    if (error) throw error;

    if (!data) {
      showNotification('未找到匹配的学生信息', 'warning');
      const panel = document.getElementById('queryResult');
      if (panel) panel.style.display = 'none';
      return;
    }

    const setText = (id, value) => {
      const el = document.getElementById(id);
      if (el) el.textContent = value || '未填写';
    };

    setText('resultName', data.name);
    setText('resultIdCard', data.id_card);
    setText('resultCollege', data.college);
    setText('resultGrade', data.grade);
    setText('resultMajor', data.major);
    setText('resultStudentId', data.student_id);
    setText('resultReportDate', formatDate(data.report_date));
    setText('resultMedicalDate', formatDate(data.medical_date));
    setText('resultMilitaryDate', formatDate(data.military_date));
    setText('resultPaymentDate', formatDate(data.payment_date));
    setText('resultBooksDate', formatDate(data.books_date));
    setText('resultDormDate', formatDate(data.dorm_date));

    const panel = document.getElementById('queryResult');
    if (panel) panel.style.display = 'block';
  } catch (error) {
    console.error('查询失败:', error);
    showNotification('查询失败，请稍后重试', 'error');
  } finally {
    setButtonLoading(queryBtn, false, '查询信息');
  }
}

async function loadCollegeData() {
  if (!currentUser) return;

  try {
    let query = supabaseClient.from('student_info').select('*').order('created_at', { ascending: false });
    if (currentUser.userType === 'college') query = query.eq('college', currentUser.college);

    const { data, error } = await query;
    if (error) throw error;

    const tbody = document.getElementById('collegeTableBody');
    if (!tbody) return;

    if (!data?.length) {
      showEmptyState('collegeTableBody', '暂无数据', 9);
      return;
    }

    tbody.innerHTML = data.map((m, idx) => `
      <tr>
        <td>${idx + 1}</td>
        <td>${escapeHTML(m.name)}</td>
        <td>${escapeHTML(m.id_card)}</td>
        <td>${escapeHTML(m.student_id)}</td>
        <td>${escapeHTML(m.grade)}</td>
        <td>${escapeHTML(m.major)}</td>
        <td>${formatDate(m.report_date)}</td>
        <td>${renderStatusBadge(m.status)}</td>
        <td><button class="btn btn-sm btn-outline-primary view-btn" data-id="${escapeHTML(m.id)}">查看</button></td>
      </tr>
    `).join('');

    tbody.querySelectorAll('.view-btn').forEach(btn => {
      btn.addEventListener('click', () => viewMemberDetails(btn.dataset.id));
    });
  } catch (error) {
    console.error('加载学院数据失败:', error);
    showEmptyState('collegeTableBody', '数据加载失败', 9);
  }
}

async function loadReviewData() {
  if (!currentUser || currentUser.userType !== 'college') return;

  try {
    const { data, error } = await supabaseClient
      .from('student_info')
      .select('*')
      .eq('college', currentUser.college)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) throw error;

    const tbody = document.getElementById('reviewTableBody');
    if (!tbody) return;

    if (!data?.length) {
      tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted">暂无待审核的记录</td></tr>`;
      return;
    }

    tbody.innerHTML = data.map((m, idx) => {
      const parts = m.submitted_parts || [];
      const partsText = escapeHTML(parts.map(getFieldDisplayName).join('、'));

      return `
        <tr>
          <td>${idx + 1}</td>
          <td>${escapeHTML(m.name)}</td>
          <td>${escapeHTML(m.id_card)}</td>
          <td>${escapeHTML(m.student_id)}</td>
          <td>${partsText}</td>
          <td>${formatDate(m.updated_at || m.created_at)}</td>
          <td><button class="btn btn-sm btn-outline-primary review-btn" data-id="${escapeHTML(m.id)}">审核</button></td>
        </tr>
      `;
    }).join('');

    tbody.querySelectorAll('.review-btn').forEach(btn => {
      btn.addEventListener('click', () => openReviewModal(btn.dataset.id));
    });
  } catch (error) {
    console.error('加载审核数据失败:', error);
    const tbody = document.getElementById('reviewTableBody');
    if (tbody) tbody.innerHTML = `<tr><td colspan="7" class="text-center text-danger">加载数据失败，请刷新重试</td></tr>`;
  }
}

async function openReviewModal(id) {
  currentReviewId = id;

  try {
    const m = await db.getStudentInfoById(id);
    const submittedParts = m.submitted_parts || [];
    const approvedParts = m.approved_parts || [];

    let html = `
      <div class="row mb-2"><div class="col-4 fw-bold">姓名：</div><div class="col-8">${escapeHTML(m.name)}</div></div>
      <div class="row mb-2"><div class="col-4 fw-bold">身份证号：</div><div class="col-8">${escapeHTML(m.id_card)}</div></div>
      <div class="row mb-2"><div class="col-4 fw-bold">学号：</div><div class="col-8">${escapeHTML(m.student_id)}</div></div>
      <div class="row mb-2"><div class="col-4 fw-bold">学院：</div><div class="col-8">${escapeHTML(m.college)}</div></div>
      <hr>
    `;

    submittedParts.forEach(part => {
      const dbField = FIELD_MAP[part];
      const value = m[dbField];
      if (!value) return;

      const isApproved = approvedParts.includes(part);
      const statusClass = isApproved ? 'field-approved' : 'field-pending';
      const statusTextStr = isApproved ? '（已审核）' : '（待审核）';

      html += `
        <div class="row mb-2">
          <div class="col-4 fw-bold ${statusClass}">${escapeHTML(getFieldDisplayName(part))}${statusTextStr}：</div>
          <div class="col-8 ${statusClass}">${formatDate(value)}</div>
        </div>
      `;
    });

    const body = document.getElementById('reviewModalBody');
    if (body) body.innerHTML = html;

    new bootstrap.Modal(document.getElementById('reviewModal')).show();
  } catch (error) {
    console.error('获取审核信息失败:', error);
    showNotification('获取审核信息失败', 'error');
  }
}

async function reviewStudentInfo(approved) {
  if (!currentReviewId) return;

  const approveBtn = document.getElementById('approveBtn');
  const rejectBtn = document.getElementById('rejectBtn');
  setButtonLoading(approveBtn, true, '处理中');
  setButtonLoading(rejectBtn, true, '处理中');

  try {
    const row = await db.getStudentInfoById(currentReviewId);
    const submittedParts = row.submitted_parts || [];
    const currentApproved = row.approved_parts || [];

    const patch = {};
    if (approved) {
      const newApproved = [...new Set([...currentApproved, ...submittedParts])];
      const allApproved = ALL_PART_FIELDS.every(f => newApproved.includes(f));

      patch.approved_parts = newApproved;
      patch.status = allApproved ? 'approved' : 'partially_approved';
      patch.reviewed_by = currentUser.username;
      patch.reviewed_at = new Date().toISOString();
      patch.submitted_parts = [];
    } else {
      patch.status = 'rejected';
    }

    await db.updateStudentInfo(currentReviewId, patch);

    showNotification(approved ? '审核通过！' : '审核拒绝！', 'success');
    bootstrap.Modal.getInstance(document.getElementById('reviewModal'))?.hide();

    await Promise.all([loadReviewData(), loadCollegeData(), loadAdminOverview(), loadAdminStudentInfos()]);
  } catch (error) {
    console.error('审核失败:', error);
    showNotification(`审核失败: ${error.message}`, 'error');
  } finally {
    setButtonLoading(approveBtn, false, '通过审核');
    setButtonLoading(rejectBtn, false, '拒绝审核');
  }
}

async function loadAdminOverview() {
  try {
    const { data, error } = await supabaseClient.from('student_info').select('*');
    if (error) throw error;
    const list = data || [];

    const totalCount = list.length;
    const pendingCount = list.filter(x => x.status === 'pending').length;
    const approvedCount = list.filter(x => x.status === 'approved').length;

    const collegeStats = {};
    list.forEach(x => {
      const college = x.college || '未知';
      const status = x.status || 'pending';
      if (!collegeStats[college]) {
        collegeStats[college] = { total: 0, pending: 0, approved: 0, rejected: 0 };
      }
      collegeStats[college].total++;
      if (status === 'pending') collegeStats[college].pending++;
      else if (status === 'approved') collegeStats[college].approved++;
      else if (status === 'rejected') collegeStats[college].rejected++;
    });

    const totalEl = document.getElementById('adminTotalCount');
    const pendingEl = document.getElementById('adminPendingCount');
    const approvedEl = document.getElementById('adminApprovedCount');
    const collegeEl = document.getElementById('adminCollegeCount');
    if (totalEl) totalEl.textContent = totalCount;
    if (pendingEl) pendingEl.textContent = pendingCount;
    if (approvedEl) approvedEl.textContent = approvedCount;
    if (collegeEl) collegeEl.textContent = Object.keys(collegeStats).length;

    const tbody = document.getElementById('collegeStatsBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    Object.keys(collegeStats).forEach(college => {
      const s = collegeStats[college];
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${escapeHTML(college)}</td>
        <td>${s.total}</td>
        <td>${s.pending}</td>
        <td>${s.approved}</td>
        <td>${s.rejected}</td>
        <td><button class="btn btn-sm btn-outline-primary view-college-btn" data-college="${escapeHTML(college)}">查看</button></td>
      `;
      tbody.appendChild(row);
    });

    tbody.querySelectorAll('.view-college-btn').forEach(btn => {
      btn.addEventListener('click', function () {
        const input = document.getElementById('adminSearchInput');
        if (input) input.value = this.dataset.college;
        document.getElementById('dataManagementTab')?.click();
        loadAdminStudentInfos();
      });
    });
  } catch (error) {
    console.error('加载总览数据失败:', error);
    showNotification('加载总览数据失败', 'error');
  }
}

async function loadAdminStudentInfos(page = 1, pageSize = 10) {
  const searchText = document.getElementById('adminSearchInput')?.value.trim() || '';

  try {
    const { data, count } = await db.listStudentInfo({ searchText, page, pageSize });
    renderAdminStudentInfosTable(data, page, pageSize);
    generateAdminPagination(page, Math.ceil((count || 0) / pageSize));
  } catch (error) {
    console.error('加载数据失败:', error);
    showEmptyState('adminDataTableBody', `加载失败: ${error.message}`);
  }
}

function renderAdminStudentInfosTable(studentInfos, page, pageSize) {
  const tbody = document.getElementById('adminDataTableBody');
  if (!tbody) return;

  if (!studentInfos.length) {
    showEmptyState('adminDataTableBody', '暂无数据');
    return;
  }

  tbody.innerHTML = studentInfos.map((m, idx) => `
    <tr>
      <td>${(page - 1) * pageSize + idx + 1}</td>
      <td>${escapeHTML(m.name)}</td>
      <td>${escapeHTML(m.id_card)}</td>
      <td>${escapeHTML(m.college)}</td>
      <td>${escapeHTML(m.student_id)}</td>
      <td>${escapeHTML(m.grade)}</td>
      <td>${escapeHTML(m.major)}</td>
      <td>${renderStatusBadge(m.status)}</td>
      <td>
        <button class="btn btn-sm btn-outline-primary view-btn" data-id="${escapeHTML(m.id)}">查看</button>
        <button class="btn btn-sm btn-outline-warning edit-btn" data-id="${escapeHTML(m.id)}">编辑</button>
        <button class="btn btn-sm btn-outline-danger delete-btn" data-id="${escapeHTML(m.id)}">删除</button>
      </td>
    </tr>
  `).join('');

  tbody.querySelectorAll('.view-btn').forEach(btn => btn.addEventListener('click', () => viewMemberDetails(btn.dataset.id)));
  tbody.querySelectorAll('.edit-btn').forEach(btn => btn.addEventListener('click', () => editMember(btn.dataset.id)));
  tbody.querySelectorAll('.delete-btn').forEach(btn => btn.addEventListener('click', () => deleteMember(btn.dataset.id)));
}

function generateAdminPagination(currentPage, totalPages) {
  const p = document.getElementById('adminPagination');
  if (!p) return;
  p.innerHTML = '';

  const createItem = (label, disabled, onClick, active = false) => {
    const li = document.createElement('li');
    li.className = `page-item ${disabled ? 'disabled' : ''} ${active ? 'active' : ''}`;
    li.innerHTML = `<a class="page-link" href="#">${escapeHTML(label)}</a>`;
    li.addEventListener('click', (e) => {
      e.preventDefault();
      if (!disabled) onClick();
    });
    return li;
  };

  p.appendChild(createItem('上一页', currentPage === 1, () => loadAdminStudentInfos(currentPage - 1)));
  for (let i = 1; i <= totalPages; i++) {
    p.appendChild(createItem(i, false, () => loadAdminStudentInfos(i), i === currentPage));
  }
  p.appendChild(createItem('下一页', currentPage === totalPages || totalPages === 0, () => loadAdminStudentInfos(currentPage + 1)));
}

async function adminAdvancedQuery() {
  const name = document.getElementById('adminQueryName')?.value.trim() || '';
  const idCard = document.getElementById('adminQueryIdCard')?.value.trim() || '';
  const studentId = document.getElementById('adminQueryStudentId')?.value.trim() || '';
  const college = document.getElementById('adminQueryCollege')?.value.trim() || '';
  const status = document.getElementById('adminQueryStatus')?.value || '';
  const date = document.getElementById('adminQueryDate')?.value || '';

  try {
    let query = supabaseClient.from('student_info').select('*').order('created_at', { ascending: false });

    if (name) query = query.ilike('name', `%${name.replace(/[%_]/g, '')}%`);
    if (idCard) query = query.ilike('id_card', `%${idCard.replace(/[%_]/g, '')}%`);
    if (studentId) query = query.ilike('student_id', `%${studentId.replace(/[%_]/g, '')}%`);
    if (college) query = query.eq('college', college);
    if (status) query = query.eq('status', status);

    if (date) {
      const startDate = new Date(date);
      startDate.setHours(0, 0, 0, 0);
      
      const endDate = new Date(date);
      endDate.setHours(23, 59, 59, 999);
      
      query = query.gte('created_at', startDate.toISOString()).lte('created_at', endDate.toISOString());
    }

    const { data, error } = await query;
    if (error) throw error;

    renderAdminQueryResults(data || []);
    const panel = document.getElementById('adminQueryResult');
    if (panel) panel.style.display = 'block';
  } catch (error) {
    console.error('高级查询失败:', error);
    showNotification('查询失败，请稍后重试', 'error');
  }
}

function renderAdminQueryResults(studentInfos) {
  const tbody = document.getElementById('adminQueryTableBody');
  if (!tbody) return;

  if (!studentInfos.length) {
    tbody.innerHTML = `<tr><td colspan="9" class="text-center text-muted">未找到匹配的记录</td></tr>`;
    return;
  }

  tbody.innerHTML = studentInfos.map((m, idx) => `
    <tr>
      <td>${idx + 1}</td>
      <td>${escapeHTML(m.name)}</td>
      <td>${escapeHTML(m.id_card)}</td>
      <td>${escapeHTML(m.college)}</td>
      <td>${escapeHTML(m.student_id)}</td>
      <td>${escapeHTML(m.grade)}</td>
      <td>${escapeHTML(m.major)}</td>
      <td>${renderStatusBadge(m.status)}</td>
      <td>
        <button class="btn btn-sm btn-outline-primary view-btn" data-id="${escapeHTML(m.id)}">查看</button>
        <button class="btn btn-sm btn-outline-warning edit-btn" data-id="${escapeHTML(m.id)}">编辑</button>
      </td>
    </tr>
  `).join('');

  tbody.querySelectorAll('.view-btn').forEach(btn => btn.addEventListener('click', () => viewMemberDetails(btn.dataset.id)));
  tbody.querySelectorAll('.edit-btn').forEach(btn => btn.addEventListener('click', () => editMember(btn.dataset.id)));
}

async function editMember(id) {
  if (!currentUser || currentUser.userType !== 'admin') {
    showNotification('无权限执行编辑操作', 'error');
    return;
  }

  currentEditId = id;
  try {
    const m = await db.getStudentInfoById(id);

    document.getElementById('editMemberId') && (document.getElementById('editMemberId').value = id);
    document.getElementById('editName') && (document.getElementById('editName').value = m.name || '');
    document.getElementById('editIdCard') && (document.getElementById('editIdCard').value = m.id_card || '');
    document.getElementById('editCollege') && (document.getElementById('editCollege').value = m.college || '');
    document.getElementById('editStudentId') && (document.getElementById('editStudentId').value = m.student_id || '');
    document.getElementById('editGrade') && (document.getElementById('editGrade').value = m.grade || '');
    document.getElementById('editMajor') && (document.getElementById('editMajor').value = m.major || '');

    document.getElementById('editReportDate') && (document.getElementById('editReportDate').value = formatDateForInput(m.report_date));
    document.getElementById('editMedicalDate') && (document.getElementById('editMedicalDate').value = formatDateForInput(m.medical_date));
    document.getElementById('editMilitaryDate') && (document.getElementById('editMilitaryDate').value = formatDateForInput(m.military_date));
    document.getElementById('editPaymentDate') && (document.getElementById('editPaymentDate').value = formatDateForInput(m.payment_date));
    document.getElementById('editBooksDate') && (document.getElementById('editBooksDate').value = formatDateForInput(m.books_date));
    document.getElementById('editDormDate') && (document.getElementById('editDormDate').value = formatDateForInput(m.dorm_date));
    document.getElementById('editStatus') && (document.getElementById('editStatus').value = m.status || 'pending');

    new bootstrap.Modal(document.getElementById('editModal')).show();
  } catch (error) {
    console.error('获取编辑信息失败:', error);
    showNotification('获取信息失败', 'error');
  }
}

async function saveEdit() {
  if (!currentEditId) return;
  if (!currentUser || currentUser.userType !== 'admin') {
    showNotification('无权限执行编辑操作', 'error');
    return;
  }

  const saveBtn = document.getElementById('saveEditBtn');
  setButtonLoading(saveBtn, true, '保存修改');

  try {
    const patch = {
      name: document.getElementById('editName')?.value.trim() || '',
      id_card: document.getElementById('editIdCard')?.value.trim() || '',
      college: document.getElementById('editCollege')?.value.trim() || '',
      student_id: document.getElementById('editStudentId')?.value.trim() || '',
      grade: document.getElementById('editGrade')?.value.trim() || '',
      major: document.getElementById('editMajor')?.value.trim() || '',
      report_date: document.getElementById('editReportDate')?.value || null,
      medical_date: document.getElementById('editMedicalDate')?.value || null,
      military_date: document.getElementById('editMilitaryDate')?.value || null,
      payment_date: document.getElementById('editPaymentDate')?.value || null,
      books_date: document.getElementById('editBooksDate')?.value || null,
      dorm_date: document.getElementById('editDormDate')?.value || null,
      status: document.getElementById('editStatus')?.value || 'pending'
    };

    await db.updateStudentInfo(currentEditId, patch);
    showNotification('信息修改成功！', 'success');

    const modal = bootstrap.Modal.getInstance(document.getElementById('editModal'));
    modal?.hide();

    await Promise.all([loadAdminOverview(), loadAdminStudentInfos(), loadStudentInfos(), loadCollegeData()]);
  } catch (error) {
    console.error('保存修改失败:', error);
    showNotification(`保存修改失败: ${error.message}`, 'error');
  } finally {
    setButtonLoading(saveBtn, false, '保存修改');
  }
}

async function deleteMember(id) {
  if (!currentUser || currentUser.userType !== 'admin') {
    showNotification('无权限执行删除操作', 'error');
    return;
  }

  if (!confirm('确定要删除这条学生报到信息吗？此操作不可恢复。')) return;

  try {
    await db.deleteStudentInfo(id);
    showNotification('删除成功', 'success');
    await Promise.all([loadStudentInfos(), loadAdminStudentInfos(), loadAdminOverview(), loadCollegeData()]);
  } catch (error) {
    console.error('删除失败:', error);
    showNotification(`删除失败: ${error.message}`, 'error');
  }
}

async function viewMemberDetails(id) {
  try {
    const m = await db.getStudentInfoById(id);

    const set = (id, value) => {
      const el = document.getElementById(id);
      if (el) el.textContent = value || '未填写';
    };

    set('detailName', m.name);
    set('detailIdCard', m.id_card);
    set('detailCollege', m.college);
    set('detailGrade', m.grade);
    set('detailMajor', m.major);
    set('detailStudentId', m.student_id);

    set('detailReportDate', formatDate(m.report_date));
    set('detailMedicalDate', formatDate(m.medical_date));
    set('detailMilitaryDate', formatDate(m.military_date));
    set('detailPaymentDate', formatDate(m.payment_date));
    set('detailBooksDate', formatDate(m.books_date));
    set('detailDormDate', formatDate(m.dorm_date));

    const detailStatus = document.getElementById('detailStatus');
    if (detailStatus) detailStatus.innerHTML = renderStatusBadge(m.status);

    new bootstrap.Modal(document.getElementById('detailModal')).show();
  } catch (error) {
    console.error('获取详细信息失败:', error);
    showNotification('获取详细信息失败', 'error');
  }
}
async function loadStudentInfos(page = 1, pageSize = 10) {
  const searchText = document.getElementById('searchInput')?.value.trim() || '';

  try {
    const { data, count } = await db.listStudentInfo({ searchText, page, pageSize });
    renderStudentInfosTable(data, page, pageSize);
    generatePagination(page, Math.ceil((count || 0) / pageSize));
    updateStats(count || 0);
  } catch (error) {
    console.error('加载数据失败:', error);
    showEmptyState('dataTableBody', `加载失败: ${error.message}`);
  }
}

function renderStudentInfosTable(studentInfos, page, pageSize) {
  const tbody = document.getElementById('dataTableBody');
  if (!tbody) return;

  if (!studentInfos.length) {
    showEmptyState('dataTableBody', '暂无数据');
    return;
  }

  tbody.innerHTML = studentInfos.map((m, idx) => `
    <tr>
      <td>${(page - 1) * pageSize + idx + 1}</td>
      <td>${escapeHTML(m.name)}</td>
      <td>${escapeHTML(m.id_card)}</td>
      <td>${escapeHTML(m.college)}</td>
      <td>${escapeHTML(m.student_id)}</td>
      <td>${escapeHTML(m.grade)}</td>
      <td>${escapeHTML(m.major)}</td>
      <td>${formatDate(m.created_at)}</td>
      <td>${renderStatusBadge(m.status)}</td>
      <td>
        <button class="btn btn-sm btn-outline-primary view-btn" data-id="${escapeHTML(m.id)}">查看</button>
        <button class="btn btn-sm btn-outline-danger delete-btn" data-id="${escapeHTML(m.id)}">删除</button>
      </td>
    </tr>
  `).join('');

  tbody.querySelectorAll('.view-btn').forEach(btn => btn.addEventListener('click', () => viewMemberDetails(btn.dataset.id)));
  tbody.querySelectorAll('.delete-btn').forEach(btn => btn.addEventListener('click', () => deleteMember(btn.dataset.id)));
}

function generatePagination(currentPage, totalPages) {
  const pagination = document.getElementById('pagination');
  if (!pagination) return;
  pagination.innerHTML = '';

  const createItem = (label, disabled, onClick, active = false) => {
    const li = document.createElement('li');
    li.className = `page-item ${disabled ? 'disabled' : ''} ${active ? 'active' : ''}`;
    li.innerHTML = `<a class="page-link" href="#">${escapeHTML(label)}</a>`;
    li.addEventListener('click', (e) => {
      e.preventDefault();
      if (!disabled) onClick();
    });
    return li;
  };

  pagination.appendChild(createItem('上一页', currentPage === 1, () => loadStudentInfos(currentPage - 1)));
  for (let i = 1; i <= totalPages; i++) {
    pagination.appendChild(createItem(i, false, () => loadStudentInfos(i), i === currentPage));
  }
  pagination.appendChild(createItem('下一页', currentPage === totalPages || totalPages === 0, () => loadStudentInfos(currentPage + 1)));
}

function updateStats(totalCount) {
  const totalEl = document.getElementById('totalCount');
  const todayEl = document.getElementById('todayCount');
  const collegeEl = document.getElementById('collegeCount');
  const monthEl = document.getElementById('monthCount');

  if (totalEl) totalEl.textContent = totalCount;
  if (todayEl) todayEl.textContent = Math.floor(totalCount * 0.05);
  if (collegeEl) collegeEl.textContent = 10;
  if (monthEl) monthEl.textContent = Math.floor(totalCount * 0.1);
}

async function exportCollegeData() {
  if (!currentUser) return;

  try {
    let query = supabaseClient.from('student_info').select('*').limit(1000);
    if (currentUser.userType === 'college') query = query.eq('college', currentUser.college);

    const { data, error } = await query;
    if (error) throw error;

    let csv = '姓名,身份证号,学院,年级,专业,学号,入学报到时间,体检完成时间,军训结业时间,学费缴纳时间,教材领取时间,宿舍入住时间,审核状态\n';
    (data || []).forEach(m => {
      csv += `"${m.name || ''}","${m.id_card || ''}","${m.college || ''}","${m.grade || ''}","${m.major || ''}","${m.student_id || ''}","${formatDate(m.report_date)}","${formatDate(m.medical_date)}","${formatDate(m.military_date)}","${formatDate(m.payment_date)}","${formatDate(m.books_date)}","${formatDate(m.dorm_date)}","${statusText(m.status)}"\n`;
    });

    downloadCSV(csv, `${currentUser.college || '学院'}信息.csv`);
  } catch (error) {
    console.error('导出学院数据失败:', error);
    showNotification('导出失败，请稍后重试', 'error');
  }
}

async function exportData() {
  try {
    const { data, error } = await supabaseClient.from('student_info').select('*').limit(1000);
    if (error) throw error;

    let csv = '姓名,身份证号,学院,年级,专业,学号,入学报到时间,体检完成时间,军训结业时间,学费缴纳时间,教材领取时间,宿舍入住时间,审核状态\n';
    (data || []).forEach(m => {
      csv += `"${m.name || ''}","${m.id_card || ''}","${m.college || ''}","${m.grade || ''}","${m.major || ''}","${m.student_id || ''}","${formatDate(m.report_date)}","${formatDate(m.medical_date)}","${formatDate(m.military_date)}","${formatDate(m.payment_date)}","${formatDate(m.books_date)}","${formatDate(m.dorm_date)}","${statusText(m.status)}"\n`;
    });

    downloadCSV(csv, '学生信息.csv');
  } catch (error) {
    console.error('导出失败:', error);
    showNotification('导出失败，请稍后重试', 'error');
  }
}

async function exportAllData() {
  try {
    const { data, error } = await supabaseClient.from('student_info').select('*').limit(1000);
    if (error) throw error;

    let csv = '姓名,身份证号,学院,年级,专业,学号,入学报到时间,体检完成时间,军训结业时间,学费缴纳时间,教材领取时间,宿舍入住时间,审核状态,提交时间\n';
    (data || []).forEach(m => {
      csv += `"${m.name || ''}","${m.id_card || ''}","${m.college || ''}","${m.grade || ''}","${m.major || ''}","${m.student_id || ''}","${formatDate(m.report_date)}","${formatDate(m.medical_date)}","${formatDate(m.military_date)}","${formatDate(m.payment_date)}","${formatDate(m.books_date)}","${formatDate(m.dorm_date)}","${statusText(m.status)}","${formatDate(m.created_at)}"\n`;
    });

    downloadCSV(csv, '学工处-学生报到信息.csv');
  } catch (error) {
    console.error('导出全部失败:', error);
    showNotification('导出失败，请稍后重试', 'error');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  initializeApp();
});