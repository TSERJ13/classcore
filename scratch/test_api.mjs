async function testApi() {
  const url = 'http://localhost:3000/api/sync/state';
  const body = {
    slug: 'stdancestudio',
    isClientPortal: true
  };

  console.log('Fetching from API...');
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    console.log('Status:', res.status);
    const data = await res.json();
    if (data.cc_student_data) {
      console.log('Found students count:', Object.keys(data.cc_student_data).length);
      const student = Object.values(data.cc_student_data).find((s: any) => s.id.toLowerCase() === 'ad3956749');
      console.log('Student ad3956749 found in API response:', !!student);
    } else {
      console.log('cc_student_data missing in response:', data);
    }
  } catch (e) {
    console.error('Fetch error:', e);
  }
}

testApi();
