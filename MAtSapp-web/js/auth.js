/**
 * MAtSapp Auth - SIMPLE VERSION
 * No SMS. No Twilio. No phone provider needed.
 * Just enter any 4+ digit code.
 */
const Auth = (() => {
  let pendingPhone = null;

  function normalizePhone(code, number) {
    const digits = (number || '').replace(/\D/g, '');
    return (code || '') + digits;
  }

  async function requestOtp(countryCode, phoneNumber) {
    const phone = normalizePhone(countryCode, phoneNumber);

    if (phone.length < 10) {
      throw new Error('Please enter a valid phone number');
    }

    pendingPhone = phone;
    console.log('%c[MAtSapp] Simple login – no SMS provider used', 'color:#25D366');
    return { phone, demo: true };
  }

  async function verifyOtp(otp) {
    if (!pendingPhone) {
      throw new Error('Please enter your phone number first');
    }

    const code = String(otp || '').trim();
    if (code.length < 4) {
      throw new Error('Enter any 4+ digit code (example: 123456)');
    }

    // Create or load user
    let user = await DB.findUserByPhone(pendingPhone);

    if (!user) {
      user = {
        id: pendingPhone,
        phone: pendingPhone,
        display_name: pendingPhone,
        status_text: 'Hey there! I am using MAtSapp.',
        avatar_url: null,
        is_admin: pendingPhone.endsWith('0000')
      };
    } else {
      user.id = user.phone || pendingPhone;
    }

    await DB.saveUser(user);
    return user;
  }

  async function completeProfile({ displayName, avatarDataUrl }) {
    const user = await DB.getCurrentUser();
    if (!user) throw new Error('Not logged in');

    user.display_name = displayName || user.phone;
    user.id = user.phone;
    if (avatarDataUrl) user.avatar_url = avatarDataUrl;

    await DB.saveUser(user);
    return user;
  }

  async function logout() {
    localStorage.removeItem('matsapp_currentUser');
    location.reload();
  }

  async function isLoggedIn() {
    const u = await DB.getCurrentUser();
    return !!u;
  }

  return {
    requestOtp,
    verifyOtp,
    completeProfile,
    logout,
    isLoggedIn,
    get pendingPhone() { return pendingPhone; }
  };
})();
