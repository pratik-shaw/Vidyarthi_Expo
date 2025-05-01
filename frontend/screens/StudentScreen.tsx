import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const StudentScreen = () => {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Welcome, Student!</Text>
    </View>
  );
};

export default StudentScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#e0f7fa',
  },
  text: {
    fontSize: 24,
    fontWeight: '600',
  },
});
