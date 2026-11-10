// Common first names, used only right after a cue such as "hi", "LG" or
// "thanks" (name-cues.ts), so that chat-style "hi anna" or "lg markus" is found
// even in lowercase. They are never matched in open text.
//
// Hand-compiled from general knowledge of common first names in the communities
// that live in Austria, about as many women's as men's names for each. The
// grouping below only keeps the list balanced; Painfold never infers anyone's
// origin, and matching ignores the groups. Spelling variants are listed where
// they are common; accents do not matter when matching ("Ayşegül" = "aysegul").
const NAMES: Record<string, { women: string, men: string }> = {
  'German-speaking': {
    women: 'Anna Maria Elisabeth Johanna Katharina Theresa Theresia Sophie Sophia Lena Laura Julia Sarah Hannah Lea Leonie Emma Marie Magdalena Barbara Christina Christine Andrea Sabine Petra Monika Claudia Gabriele Brigitte Susanne Ursula Helga Ingrid Renate Martina Daniela Stefanie Verena Carina Nina Lisa Elena Valentina Hannelore Anneliese Veronika Waltraud Gertrud Herta Eva Ida Paula Clara Klara Mia Emilia Franziska',
    men: 'Johann Josef Franz Karl Anton Georg Michael Thomas Andreas Stefan Christian Martin Markus Peter Wolfgang Gerhard Helmut Herbert Manfred Werner Günter Günther Florian Lukas Lucas Maximilian Felix Jakob David Simon Tobias Matthias Daniel Patrick Alexander Sebastian Philipp Dominik Fabian Julian Elias Noah Leon Paul Jonas Moritz Leopold Ferdinand Klaus Jürgen Bernhard Reinhard Herwig Gottfried',
  },
  'English': {
    women: 'Olivia Amelia Isla Ava Emily Grace Charlotte Sophie Lily Ella Chloe Jessica Hannah Rebecca Rachel Lucy Katie Laura Emma Sarah Amy Holly Megan Lauren Eleanor Harriet Alice Florence Imogen Poppy Evie Freya Abigail Victoria Elizabeth Catherine Helen Margaret Susan Jennifer Karen Linda Patricia Nancy Ashley Brittany Madison Tiffany Heather Siobhan Niamh Aoife',
    men: 'Oliver George Harry Jack Jacob Charlie Thomas Oscar William James Henry Alfie Leo Joshua Daniel Samuel Joseph Benjamin Edward Matthew Luke Ryan Liam Connor Callum Jamie Lewis Nathan Adam Robert Richard David Andrew Christopher Michael Paul Steven Simon Peter Anthony Kevin Brian Gary Neil Graham Ian Stuart Craig Sean Declan Ciaran Owen Rhys Dylan Ethan Tyler',
  },
  'Bosnian, Serbian, Croatian': {
    women: 'Amra Amela Emina Lejla Selma Ajla Aida Alma Merima Mirela Sanela Edina Jasmina Azra Dženana Nermina Samira Maja Ana Ivana Marija Petra Jelena Milica Katarina Tamara Snežana Dragana Biljana Gordana Vesna Mirjana Ljiljana Danijela Sanja Tanja Nataša Dijana Jovana Teodora Anđela Mila Sara Lana Iva Nikolina Kristina',
    men: 'Amir Emir Adnan Haris Kenan Tarik Edin Nedim Senad Mirza Armin Damir Alen Elvis Almir Dženan Samir Mehmed Ivan Marko Luka Petar Nikola Stefan Milan Dragan Zoran Goran Dejan Nenad Miloš Vuk Filip Josip Tomislav Ante Mario Igor Darko Vladimir Bojan Branko Srđan Đorđe Aleksandar Dario Matej',
  },
  'Turkish': {
    women: 'Ayşe Fatma Emine Hatice Zeynep Elif Merve Büşra Esra Kübra Ayşegül Gül Gülsüm Hülya Sibel Derya Deniz Ebru Özlem Esin Sevgi Songül Serpil Selin Ceren Damla Ecem İrem Melike Nur Nurcan Sultan Yasemin Zehra Aslı Burcu Cansu Dilara Duygu Eda Ilayda Pınar Tuba Hilal',
    men: 'Mehmet Mustafa Ahmet Ali Hüseyin Hasan İbrahim İsmail Osman Yusuf Murat Ömer Ramazan Halil Süleyman Abdullah Mahmut Recep Emre Burak Mert Kerem Serkan Volkan Hakan Tolga Barış Onur Ozan Oğuz Cem Can Arda Efe Eren Berk Kaan Umut Uğur Furkan Enes Selim Tuncay Erdem Levent Kemal',
  },
  'Romanian': {
    women: 'Maria Elena Ioana Andreea Alexandra Mihaela Cristina Ana Gabriela Daniela Florentina Florina Georgiana Roxana Raluca Simona Adriana Alina Bianca Diana Irina Larisa Loredana Monica Oana Ramona Corina Camelia Carmen Lavinia Luminița Mădălina Nicoleta Petronela Rodica Silvia Teodora Valentina Violeta Denisa Iulia Delia Anca Doina',
    men: 'Ion Ioan Andrei Alexandru Mihai Constantin Gheorghe Vasile Nicolae Ștefan Florin Marian Adrian Cristian Daniel Gabriel Bogdan Cătălin Ciprian Claudiu Costel Dorin Dragoș Dumitru Emil Eugen Horia Iulian Laurențiu Liviu Lucian Marius Ovidiu Petru Radu Remus Sorin Tudor Valentin Victor Viorel Sergiu Răzvan Octavian',
  },
  'Hungarian': {
    women: 'Anna Zsófia Zsuzsanna Katalin Erzsébet Ilona Éva Mária Judit Ágnes Andrea Krisztina Eszter Réka Dóra Nóra Petra Viktória Boglárka Csilla Enikő Gabriella Hajnalka Ildikó Kinga Lilla Melinda Orsolya Szilvia Tímea Bernadett Brigitta Emese Fanni Gréta Hanna Jázmin Luca Zita Anikó Edit Gizella Márta',
    men: 'László István József János Zoltán Sándor Gábor Ferenc Attila Péter Tamás Zsolt Tibor András Csaba Imre Lajos Balázs Dávid Bence Máté Levente Ádám Dániel Gergely Krisztián Miklós Norbert Róbert Szabolcs Viktor Bálint Botond Dénes Kristóf Márk Marcell Olivér Zalán Barnabás Endre Géza Gyula Kálmán',
  },
  'Polish': {
    women: 'Anna Maria Katarzyna Małgorzata Agnieszka Barbara Ewa Krystyna Elżbieta Magdalena Joanna Aleksandra Monika Zofia Natalia Julia Zuzanna Karolina Paulina Justyna Marta Dorota Beata Jolanta Iwona Grażyna Halina Danuta Renata Sylwia Agata Weronika Martyna Wiktoria Oliwia Kinga Alicja Gabriela Patrycja Izabela Kamila Edyta Urszula',
    men: 'Piotr Krzysztof Andrzej Tomasz Paweł Michał Marcin Jakub Adam Łukasz Mateusz Kamil Bartosz Dawid Grzegorz Marek Wojciech Rafał Robert Mariusz Sebastian Dariusz Jacek Janusz Kacper Szymon Filip Jan Antoni Wiktor Igor Oskar Patryk Przemysław Sławomir Zbigniew Leszek Jerzy Ryszard Tadeusz Mirosław Jędrzej Maciej Hubert',
  },
  'Ukrainian': {
    women: 'Olena Olha Olga Nataliia Natalia Tetiana Tatiana Iryna Svitlana Oksana Yulia Yuliia Kateryna Anastasiia Anastasia Mariia Daria Viktoriia Alina Halyna Liudmyla Lyudmyla Nadiia Valentyna Larysa Inna Khrystyna Solomiia Sofiia Zlata Uliana Vira Lesia Marta Oleksandra Yana Diana Bohdana Taisiia Polina Myroslava Ruslana Liliia',
    men: 'Oleksandr Oleksii Andrii Serhii Dmytro Volodymyr Mykola Ivan Vasyl Yurii Viktor Ihor Oleh Taras Bohdan Petro Pavlo Roman Maksym Mykhailo Artem Denys Yaroslav Vitalii Ruslan Anatolii Vadym Stepan Ostap Danylo Nazar Kyrylo Yevhen Borys Hryhorii Fedir Lev Matvii Tymofii Illia Valerii Rostyslav Vladyslav Anton',
  },
  'Arabic': {
    women: 'Fatima Fatma Aisha Aischa Maryam Mariam Khadija Zainab Zaynab Amina Layla Leila Nour Noor Huda Hanan Rania Rana Lina Dina Sara Salma Yasmin Jasmin Hiba Ghada Rasha Reem Samira Samar Mona Nadia Nada Sawsan Suad Widad Iman Asma Rawan Shatha Duaa Malak Jana Lamar Ruba',
    men: 'Mohammed Muhammad Mohamed Mohamad Mohammad Ahmad Ahmed Ali Omar Umar Hassan Hussein Husein Ibrahim Khaled Khalid Mahmoud Mahmud Mustafa Youssef Yousef Yusuf Abdullah Abdul Abdel Rahman Karim Kareem Samir Tarek Tariq Walid Nabil Rami Sami Fadi Bilal Hamza Anas Amr Ziad Majid Saeed Said Faisal Jamal Nasser Ammar Basel',
  },
  'Afghan': {
    women: 'Mursal Marwa Mariam Fatima Zahra Zohra Shabana Shukria Farzana Fariba Freshta Fereshta Gulalai Malalai Malala Nargis Parwana Pari Roya Sahar Sima Soraya Tahmina Wahida Zarghuna Zarmina Zainab Laila Hasina Habiba Homa Khatera Lida Mahbooba Masooda Nazanin Nilofar Palwasha Rahima Shirin Tamana Yalda Zakia',
    men: 'Ahmad Mohammad Ali Abdul Ghulam Hamid Rahim Karim Nasir Naser Rashid Sayed Said Wahid Zabihullah Habibullah Rahmatullah Samiullah Hekmatullah Ajmal Aziz Bashir Farid Farhad Fawad Haroon Jawad Javid Khalil Mansoor Massoud Mirwais Mujtaba Murtaza Najib Omid Qasim Rustam Sohrab Shafiq Tamim Yama Zia Zalmai Elyas Hamed',
  },
  'African': {
    women: 'Amara Ama Akosua Abena Adwoa Efua Esi Adaeze Adaobi Chiamaka Chioma Ngozi Nkechi Ifeoma Ifeoluwa Folake Funmilayo Yetunde Bisola Temitope Tolulope Aisha Fatoumata Aminata Mariama Awa Hawa Kadiatou Halima Hodan Amina Ayaan Faduma Hibaq Sagal Ifrah Wanjiru Wambui Njeri Akinyi Achieng Nia Zawadi Imani Makena Thandiwe Nomvula Lindiwe Zanele Selam Tigist Meron Hiwot Senait',
    men: 'Kwame Kofi Kojo Kwabena Yaw Kwaku Kwasi Chinedu Chukwuemeka Emeka Obinna Ikechukwu Oluwaseun Olumide Tunde Babatunde Adebayo Ayodele Femi Segun Musa Ibrahim Abdoulaye Mamadou Moussa Ousmane Amadou Seydou Cheikh Abdi Abdirahman Mohamed Ahmed Farah Hassan Kamau Otieno Odhiambo Kiprono Baraka Juma Jabari Sipho Thabo Themba Bongani Tendai Tafadzwa Dawit Yonas Tesfaye Abebe Haile',
  },
  'South Asian': {
    women: 'Priya Ananya Aisha Anjali Deepa Divya Kavya Lakshmi Meera Neha Pooja Puja Riya Sana Shreya Sneha Sunita Swati Aarti Arti Geeta Gita Jyoti Kiran Lata Manisha Nisha Rekha Shalini Simran Sonia Asha Fatima Ayesha Farah Hina Mehwish Nadia Rabia Saima Sadia Shazia Sumaira Zara Nusrat Tahmina Fahmida Shirin Tanvi Ishita',
    men: 'Arjun Rahul Rohan Amit Anil Ajay Vijay Sanjay Raj Rajesh Ravi Suresh Ramesh Mahesh Ganesh Deepak Manoj Vikram Karan Arun Sunil Nikhil Pranav Siddharth Aditya Harish Vivek Gaurav Abhishek Ankit Imran Ali Usman Bilal Hamza Faisal Asif Tariq Kamran Zubair Salman Shahid Waqar Rizwan Rashid Kabir Tanvir Arif Rakib Sabbir Harpreet Gurpreet Manpreet Jaspreet',
  },
  'East Asian': {
    women: 'Mei Ling Li Na Xiu Ying Fang Jing Hui Yan Lan Xin Yu Wei Hua Min Ji Hye Jin Seo Yeon Eun Ha Ji Yun Soo Ah Aiko Yuki Yui Haruka Sakura Hana Mai Rina Yoko Keiko Naomi Emi Saki Lan Linh Mai Thu Huong Hoa Ngoc Trang Thao Hanh Nhung Phuong',
    men: 'Wei Jun Hao Lei Yang Tao Ming Jian Bo Chen Feng Gang Hong Qiang Long Zhi Min Jun Seo Joon Ji Hoon Dong Hyun Sung Min Jae Woo Hiroshi Takeshi Kenji Haruto Yuto Sota Daiki Kenta Takumi Ryo Shota Yuki Minh Huy Duc Tuan Anh Hung Long Nam Quang Thanh Trung Khoa Bao',
  },
}

// First names that are also everyday words. They are still found when written
// as names ("Thanks, Will"), but not in lowercase, where "hi can you help" or
// "lg mark" are far more likely to be words.
const ALSO_WORDS = new Set(['can', 'will', 'mark', 'may', 'june', 'grace', 'hope', 'faith', 'joy', 'rose', 'bill', 'sunny', 'rich', 'ray', 'guy', 'art', 'nick', 'pat', 'sue', 'dean', 'per', 'jan', 'ha', 'ah', 'an', 'na', 'li', 'yu', 'bo', 'ji', 'nur', 'nam', 'long', 'min', 'ali', 'said', 'lan', 'hoa', 'sara', 'mai', 'ama', 'awa', 'nia', 'lev', 'ida', 'lea', 'gul', 'iva', 'eda', 'efe', 'mila', 'pari', 'homa', 'lida', 'mona', 'nada', 'rana', 'samar'])

/** A first name in a form that ignores case and accents: "Ayşegül" and "aysegul" are the same. */
export function nameKey(word: string): string {
  return word.toLowerCase().replace(/ß/g, 'ss').replace(/[ıİ]/g, 'i').replace(/ł/g, 'l').replace(/đ/g, 'd').replace(/ø/g, 'o').normalize('NFD').replace(/\p{M}/gu, '')
}

const KEYS: ReadonlySet<string> = new Set(Object.values(NAMES).flatMap(({ women, men }) => `${women} ${men}`.split(' ')).map(nameKey))

/** Every name in the list, as written, for tests and reports. */
export const FIRST_NAMES: readonly string[] = [...new Set(Object.values(NAMES).flatMap(({ women, men }) => `${women} ${men}`.split(' ')))]

/** Whether a word is a known first name. In lowercase, names that are also everyday words do not count. */
export function isFirstName(word: string, { lowercase = false }: { lowercase?: boolean } = {}): boolean {
  const key = nameKey(word)
  if (lowercase && ALSO_WORDS.has(key)) return false
  return KEYS.has(key)
}
