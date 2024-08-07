function showExercise(exerciseNumber) {
    // Hide all exercises
    const exercises = document.querySelectorAll('.exercise');
    exercises.forEach(exercise => exercise.classList.remove('active'));

    // Remove active class from all buttons
    const buttons = document.querySelectorAll('.sidebar-btn');
    buttons.forEach(button => button.classList.remove('active'));

    // Show selected exercise
    document.getElementById(`exercise${exerciseNumber}`).classList.add('active');
    buttons[exerciseNumber - 1].classList.add('active');
}

function calculateSalary() {
    const dailyWage = parseFloat(document.getElementById('dailyWage').value);
    const workingDays = parseFloat(document.getElementById('workingDays').value);

    const salaryResultDiv = document.getElementById('salaryResult');
    salaryResultDiv.textContent = '';

    if (isNaN(dailyWage) || isNaN(workingDays)) {
        salaryResultDiv.textContent = 'Vui lòng nhập số hợp lệ cho cả hai trường.';
        return;
    }

    if (dailyWage < 0 || workingDays < 0) {
        salaryResultDiv.textContent = 'Vui lòng nhập giá trị dương cho cả hai trường.';
        return;
    }

    const totalSalary = dailyWage * workingDays;
    salaryResultDiv.textContent = `Tổng lương là ${totalSalary.toLocaleString('vn-VN')} VND.`;
}

function calculateAverage() {
    const numbers = [
        parseFloat(document.getElementById('number1').value),
        parseFloat(document.getElementById('number2').value),
        parseFloat(document.getElementById('number3').value),
        parseFloat(document.getElementById('number4').value),
        parseFloat(document.getElementById('number5').value),
    ];

    const averageResultDiv = document.getElementById('averageResult');
    averageResultDiv.textContent = '';

    if (numbers.some(isNaN)) {
        averageResultDiv.textContent = 'Vui lòng nhập số hợp lệ cho tất cả các trường.';
        return;
    }

    const average = numbers.reduce((sum, num) => sum + num, 0) / numbers.length;
    averageResultDiv.textContent = `Giá trị trung bình là ${average.toFixed(2)}.`;
}

function convertCurrency() {
    const usdAmount = parseFloat(document.getElementById('usdAmount').value);
    const currencyResultDiv = document.getElementById('currencyResult');

    currencyResultDiv.textContent = '';

    if (isNaN(usdAmount) || usdAmount < 0) {
        currencyResultDiv.textContent = 'Vui lòng nhập một số tiền USD hợp lệ.';
        return;
    }

    const exchangeRate = 23500; // Example rate
    const vndAmount = usdAmount * exchangeRate;

    currencyResultDiv.textContent = `${usdAmount} USD = ${vndAmount.toLocaleString('vn-VN')} VND.`;
}

function calculateRectangle() {
    const width = parseFloat(document.getElementById('rectangleWidth').value);
    const height = parseFloat(document.getElementById('rectangleHeight').value);

    const rectangleResultDiv = document.getElementById('rectangleResult');
    rectangleResultDiv.textContent = '';

    if (isNaN(width) || isNaN(height) || width <= 0 || height <= 0) {
        rectangleResultDiv.textContent = 'Vui lòng nhập kích thước hợp lệ cho cả chiều rộng và chiều dài.';
        return;
    }

    const area = width * height;
    const perimeter = 2 * (width + height);

    rectangleResultDiv.textContent = `Diện tích là ${area.toFixed(2)}, chu vi là ${perimeter.toFixed(2)}.`;
}

function sumOfDigits() {
    const number = document.getElementById('digitNumber').value;
    const digitResultDiv = document.getElementById('digitResult');
    digitResultDiv.textContent = '';

    if (isNaN(number) || number < 10 || number > 99) {
        digitResultDiv.textContent = 'Vui lòng nhập một số có 2 chữ số.';
        return;
    }

    const digits = number.split('');
    const sum = digits.reduce((acc, digit) => acc + parseInt(digit, 10), 0);

    digitResultDiv.textContent = `Tổng các chữ số là ${sum}.`;
}
